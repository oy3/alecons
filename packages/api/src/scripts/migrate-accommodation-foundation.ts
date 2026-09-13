import { config } from 'dotenv';
import { createConnection, Types } from 'mongoose';

config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
config();

async function run() {
    const apply = process.argv.includes('--apply');
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('DATABASE_URL is required');

    const connection = await createConnection(uri).asPromise();
    try {
        const db = connection.db;
        if (!db) throw new Error('MongoDB connection did not expose a database');

        const agreements = db.collection('tenancyagreements');
        const students = db.collection('students');
        const users = db.collection('users');
        const admissionApplications = db.collection('applications');
        const accommodationApplications = db.collection('accommodationapplications');
        const paymentTransactions = db.collection('paymenttransactions');
        const payments = db.collection('payments');
        const sessionControls = db.collection('sessioncontrols');
        const cursor = agreements.find({});

        const summary = { candidates: 0, ready: 0, skipped: 0, agreementsUpdated: 0, applicationsCreated: 0, paidAgreementsLinked: 0, externalAgreementsRequired: 0 };
        const externalApplicationsRequiringAgreement: Types.ObjectId[] = [];
        const plans: Array<{
            agreementId: Types.ObjectId;
            academicSessionId: Types.ObjectId;
            applicationId?: Types.ObjectId;
            application?: Record<string, unknown>;
            existingAgreementStatus?: string;
            successfulTransaction?: { _id: Types.ObjectId; paidAt?: Date };
            studentId: Types.ObjectId;
            userId: Types.ObjectId;
        }> = [];

        for await (const agreement of cursor) {
            summary.candidates += 1;
            const student = await students.findOne({ _id: agreement.studentId });
            const academicSessionId = agreement.academicSessionId || student?.academicSession || student?.entryAcademicSession;
            const userId = student?.userId;
            if (!student || !userId || !academicSessionId) {
                summary.skipped += 1;
                console.warn(`Skipping agreement ${agreement._id}: student, user, or academic session is missing`);
                continue;
            }

            let accommodationApplication = agreement.accommodationApplicationId
                ? await accommodationApplications.findOne({ _id: agreement.accommodationApplicationId })
                : await accommodationApplications.findOne({ userId, academicSessionId });

            let application: Record<string, unknown> | undefined;
            if (!accommodationApplication) {
                const user = await users.findOne({ _id: userId }, { projection: { gender: 1 } });
                const admissionApplication = student.applicationId
                    ? await admissionApplications.findOne({ _id: student.applicationId }, { projection: { gender: 1 } })
                    : null;
                const gender = String(user?.gender || admissionApplication?.gender || '').toLowerCase();
                if (!['male', 'female'].includes(gender)) {
                    summary.skipped += 1;
                    console.warn(`Skipping agreement ${agreement._id}: student gender is missing`);
                    continue;
                }
                const now = new Date();
                application = {
                    applicationNumber: `ACC-MIG-${agreement._id.toString().slice(-10).toUpperCase()}`,
                    userId,
                    studentId: student._id,
                    academicSessionId,
                    applicantType: 'internal',
                    status: 'awaiting_payment',
                    category: 'student',
                    gender,
                    submittedAt: agreement.agreementTerms?.signedAt || agreement.createdAt || now,
                    createdAt: agreement.createdAt || now,
                    updatedAt: now,
                };
            }

            const sessionControl = await sessionControls.findOne({ academicSessionId });
            let internalPaymentId = sessionControl?.accommodation?.internalPaymentId;
            if (!internalPaymentId) {
                internalPaymentId = (await payments.findOne(
                    { paymentCode: 'accommodationFee' },
                    { projection: { _id: 1 } },
                ))?._id;
            }
            const successfulTransaction = internalPaymentId
                ? await paymentTransactions.findOne(
                    {
                        userId,
                        academicSessionId,
                        paymentId: internalPaymentId,
                        status: 'successful',
                    },
                    { projection: { _id: 1, paidAt: 1 } },
                )
                : null;

            plans.push({
                agreementId: agreement._id,
                academicSessionId,
                applicationId: accommodationApplication?._id,
                application,
                existingAgreementStatus: agreement.status,
                successfulTransaction: successfulTransaction
                    ? { _id: successfulTransaction._id, paidAt: successfulTransaction.paidAt }
                    : undefined,
                studentId: student._id,
                userId,
            });
            summary.ready += 1;
        }

        const unsignedExternalApplications = await accommodationApplications.find({
            applicantType: 'external',
            status: 'awaiting_payment',
            externalResidentId: { $exists: true },
        }).toArray();
        for (const application of unsignedExternalApplications) {
            const agreement = await agreements.findOne({ accommodationApplicationId: application._id });
            if (!agreement) {
                externalApplicationsRequiringAgreement.push(application._id);
                summary.externalAgreementsRequired += 1;
            }
        }

        console.log(JSON.stringify({ apply, ...summary }, null, 2));
        if (!apply) {
            console.log('Dry run complete. Re-run with --apply after taking a database backup.');
            return;
        }


        const tenancyIndexes = await agreements.indexes().catch(() => []);
        const obsoleteStudentSessionIndex = tenancyIndexes.find((index) =>
            index.unique === true
            && index.key?.studentId === 1
            && index.key?.academicSessionId === 1
            && !index.partialFilterExpression,
        );
        if (obsoleteStudentSessionIndex?.name && obsoleteStudentSessionIndex.name !== '_id_') {
            await agreements.dropIndex(obsoleteStudentSessionIndex.name);
            console.log(`Dropped obsolete tenancy agreement index ${obsoleteStudentSessionIndex.name}`);
        }
        await agreements.createIndex(
            { studentId: 1, academicSessionId: 1 },
            { unique: true, partialFilterExpression: { studentId: { $type: 'objectId' } }, name: 'uniq_tenancy_student_session' },
        );
        await agreements.createIndex(
            { externalResidentId: 1, academicSessionId: 1 },
            { unique: true, partialFilterExpression: { externalResidentId: { $type: 'objectId' } }, name: 'uniq_tenancy_external_session' },
        );

        if (externalApplicationsRequiringAgreement.length) {
            await accommodationApplications.updateMany(
                { _id: { $in: externalApplicationsRequiringAgreement } },
                { $set: { status: 'awaiting_agreement', updatedAt: new Date() } },
            );
        }

        const assignmentIndexes = await db.collection('accommodationassignments').indexes().catch(() => []);
        const obsoleteUniqueIndex = assignmentIndexes.find((index) =>
            index.unique === true
            && Object.keys(index.key || {}).length === 1
            && index.key?.accommodationApplicationId === 1,
        );
        if (obsoleteUniqueIndex?.name && obsoleteUniqueIndex.name !== '_id_') {
            await db.collection('accommodationassignments').dropIndex(obsoleteUniqueIndex.name);
            console.log(`Dropped obsolete assignment index ${obsoleteUniqueIndex.name}`);
        }

        for (const plan of plans) {
            let applicationId = plan.applicationId;
            if (!applicationId && plan.application) {
                const inserted = await accommodationApplications.insertOne(plan.application);
                applicationId = inserted.insertedId;
                summary.applicationsCreated += 1;
            }
            if (plan.successfulTransaction && applicationId) {
                const paidAt = plan.successfulTransaction.paidAt || new Date();
                await accommodationApplications.updateOne(
                    { _id: applicationId, status: { $ne: 'allocated' } },
                    { $set: { status: 'paid_awaiting_allocation', paidAt, updatedAt: new Date() } },
                );
                await paymentTransactions.updateOne(
                    { _id: plan.successfulTransaction._id },
                    {
                        $set: {
                            studentId: plan.studentId,
                            accommodationApplicationId: applicationId,
                            payerType: 'student',
                            paymentContext: 'accommodation_application',
                        },
                    },
                );
                summary.paidAgreementsLinked += 1;
            }
            await agreements.updateOne(
                { _id: plan.agreementId },
                {
                    $set: {
                        academicSessionId: plan.academicSessionId,
                        accommodationApplicationId: applicationId,
                        status: plan.successfulTransaction
                            ? 'executed'
                            : (plan.existingAgreementStatus || 'signed_awaiting_payment'),
                        updatedAt: new Date(),
                    },
                },
            );
            summary.agreementsUpdated += 1;
        }

        console.log(JSON.stringify({ complete: true, ...summary }, null, 2));
    } finally {
        await connection.close();
    }
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
