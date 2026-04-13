import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import mongoose, { Schema, Types } from 'mongoose';

const loggerPrefix = '[UserPhoneBackfill]';

type UserDocumentShape = {
    _id: Types.ObjectId;
    email?: string;
    phone?: string;
};

type ApplicationDocumentShape = {
    _id: Types.ObjectId;
    userId?: Types.ObjectId;
    phone?: string;
    applicationNumber?: string;
};

const userSchema = new Schema(
    {
        email: String,
        phone: String,
    },
    { collection: 'users', strict: false },
);

const applicationSchema = new Schema(
    {
        userId: Schema.Types.ObjectId,
        phone: String,
        applicationNumber: String,
    },
    { collection: 'applications', strict: false },
);

function loadEnvironmentVariables() {
    const envFileCandidates = [
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
        '.env',
    ];

    for (const envFileName of envFileCandidates) {
        const envPath = join(process.cwd(), envFileName);

        if (!existsSync(envPath)) {
            continue;
        }

        const content = readFileSync(envPath, 'utf-8');
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const separatorIndex = trimmedLine.indexOf('=');
            if (separatorIndex === -1) {
                continue;
            }

            const key = trimmedLine.slice(0, separatorIndex).trim();
            const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

            if (!key || process.env[key] !== undefined) {
                continue;
            }

            process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
        }
    }
}

async function backfillUserPhones() {
    loadEnvironmentVariables();

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error(`${loggerPrefix} DATABASE_URL is not set.`);
        process.exitCode = 1;
        return;
    }

    const UserModel = mongoose.model<UserDocumentShape>('BackfillUser', userSchema);
    const ApplicationModel = mongoose.model<ApplicationDocumentShape>('BackfillApplication', applicationSchema);

    let updatedCount = 0;
    let skippedWithExistingPhone = 0;
    let skippedWithoutUser = 0;
    let inspectedCount = 0;

    try {
        await mongoose.connect(databaseUrl);
        console.log(`${loggerPrefix} Connected to MongoDB.`);

        const cursor = ApplicationModel.find({
            phone: { $exists: true, $nin: [null, ''] },
            userId: { $exists: true, $ne: null },
        })
            .select('_id userId phone applicationNumber')
            .lean()
            .cursor();

        for await (const application of cursor) {
            inspectedCount += 1;

            if (!application.userId) {
                skippedWithoutUser += 1;
                continue;
            }

            const user = await UserModel.findById(application.userId)
                .select('_id phone email')
                .lean();

            if (!user) {
                skippedWithoutUser += 1;
                console.warn(
                    `${loggerPrefix} Skipping application ${application.applicationNumber || application._id} because linked user was not found.`,
                );
                continue;
            }

            if (user.phone) {
                skippedWithExistingPhone += 1;
                continue;
            }

            await UserModel.updateOne(
                { _id: user._id, phone: { $in: [null, ''] } },
                { $set: { phone: application.phone } },
            );

            updatedCount += 1;

            if (updatedCount <= 20 || updatedCount % 100 === 0) {
                console.log(
                    `${loggerPrefix} Backfilled phone for user ${user.email || user._id} from application ${application.applicationNumber || application._id}.`,
                );
            }
        }

        console.log(
            `${loggerPrefix} Complete. Inspected: ${inspectedCount}, updated: ${updatedCount}, skipped-existing: ${skippedWithExistingPhone}, skipped-missing-user: ${skippedWithoutUser}.`,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        console.error(`${loggerPrefix} Failed: ${message}`);
        if (stack) {
            console.error(stack);
        }
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

void backfillUserPhones();