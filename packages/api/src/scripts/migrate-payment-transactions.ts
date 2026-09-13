import { config } from 'dotenv';
import { createConnection, Types } from 'mongoose';

config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
config();

const SOURCE = 'studentpayments';
const TARGET = 'paymenttransactions';

async function run() {
    const apply = process.argv.includes('--apply');
    const rollback = process.argv.includes('--rollback');
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('DATABASE_URL is required');

    const connection = await createConnection(uri).asPromise();
    try {
        const db = connection.db;
        if (!db) throw new Error('MongoDB connection did not expose a database');
        const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
        const sourceExists = collections.has(SOURCE);
        const targetExists = collections.has(TARGET);

        if (rollback) {
            if (sourceExists && targetExists) {
                throw new Error(`Both ${SOURCE} and ${TARGET} exist. Refusing to roll back an ambiguous state.`);
            }
            if (sourceExists) {
                console.log(`${SOURCE} already exists; no collection rollback is required.`);
                return;
            }
            if (!targetExists) {
                throw new Error(`${TARGET} does not exist and cannot be rolled back.`);
            }
            await db.collection(TARGET).rename(SOURCE, { dropTarget: false });
            console.log(`Rollback complete. ${TARGET} was renamed to ${SOURCE}.`);
            return;
        }

        if (sourceExists && targetExists) {
            throw new Error(`Both ${SOURCE} and ${TARGET} exist. Resolve the conflicting collections before migration.`);
        }
        if (!sourceExists && !targetExists) {
            throw new Error(`Neither ${SOURCE} nor ${TARGET} exists. Nothing can be migrated.`);
        }

        const collection = db.collection(sourceExists ? SOURCE : TARGET);
        const total = await collection.countDocuments();
        const missingClassification = await collection.countDocuments({
            $or: [
                { payerType: { $exists: false } },
                { paymentContext: { $exists: false } },
            ],
        });

        console.log(JSON.stringify({ apply, sourceExists, targetExists, total, missingClassification }, null, 2));
        if (!apply) {
            console.log('Dry run complete. Re-run with --apply after taking a database backup.');
            return;
        }

        if (sourceExists) {
            await collection.rename(TARGET, { dropTarget: false });
        }

        const transactions = db.collection(TARGET);
        const cursor = transactions.find({
            $or: [
                { payerType: { $exists: false } },
                { paymentContext: { $exists: false } },
                { payerType: 'student', studentId: { $exists: false } },
            ],
        });
        const operations: any[] = [];

        for await (const transaction of cursor) {
            const student = transaction.userId && Types.ObjectId.isValid(transaction.userId)
                ? await db.collection('students').findOne(
                    { userId: new Types.ObjectId(transaction.userId) },
                    { projection: { _id: 1 } },
                )
                : null;
            const isStudent = Boolean(student?._id);
            const update: Record<string, unknown> = {};

            if (!transaction.payerType) update.payerType = isStudent ? 'student' : 'applicant';
            if (!transaction.paymentContext) update.paymentContext = isStudent ? 'student_account' : 'admission_application';

            if (student?._id) update.studentId = student._id;

            operations.push({ updateOne: { filter: { _id: transaction._id }, update: { $set: update } } });
            if (operations.length === 500) {
                await transactions.bulkWrite(operations, { ordered: false });
                operations.length = 0;
            }
        }
        if (operations.length) await transactions.bulkWrite(operations, { ordered: false });

        console.log(`Migration complete. ${TARGET} now contains ${await transactions.countDocuments()} records.`);
    } finally {
        await connection.close();
    }
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
