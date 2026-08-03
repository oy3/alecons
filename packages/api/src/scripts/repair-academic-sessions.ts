import mongoose from 'mongoose';
import { Logger } from '@nestjs/common';

const logger = new Logger('RepairAcademicSessions');
const hasFlag = (flag: string) => process.argv.includes(flag);

async function run() {
    const apply = hasFlag('--apply');

    const dbUrl = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alecons';

    logger.log(`Connecting to ${dbUrl.replace(/:.+@/, ':***@')}`);

    try {
        await mongoose.connect(dbUrl, { dbName: undefined, maxPoolSize: 5 });

        const coll = mongoose.connection.db.collection('academicsessions');

        // Check for legacy index
        let legacyIndexName: string | null = null;
        try {
            const indexes = await coll.indexes();
            const legacyIndex = indexes.find((idx: any) => idx.key && idx.key.sessionYear === 1 && idx.unique);
            if (legacyIndex && legacyIndex.name) legacyIndexName = legacyIndex.name;
        } catch (error) {
            logger.warn('Failed to list collection indexes:', error?.message || error);
        }

        logger.log(`Legacy sessionYear unique index present: ${legacyIndexName ? 'yes (' + legacyIndexName + ')' : 'no'}`);

        // Stream documents with server cursor
        const cursor = coll.find({}).sort({ createdAt: 1 }).batchSize(100);
        const seen = new Map<string, string>();
        let duplicateCount = 0;

        for await (const doc of cursor) {
            const key = String(doc.sessionYear || '');
            if (!seen.has(key)) {
                seen.set(key, String(doc._id));
                continue;
            }

            duplicateCount += 1;
            logger.warn(`Duplicate found: sessionYear=${key} id=${String(doc._id)}`);
        }

        if (duplicateCount === 0) {
            logger.log('No duplicate academic session years found.');
        } else {
            logger.warn(`Found ${duplicateCount} duplicate academic session year entries.`);
        }

        if (apply && legacyIndexName) {
            try {
                logger.warn(`--apply provided: dropping legacy index ${legacyIndexName}`);
                await coll.dropIndex(legacyIndexName);
                logger.log(`Dropped index ${legacyIndexName}`);
            } catch (error) {
                logger.error('Failed to drop legacy index:', error?.message || error);
            }
        } else if (apply && !legacyIndexName) {
            logger.log('--apply provided but no legacy index found to drop.');
        }

        logger.log('Dry-run complete. Re-run with --apply to drop the legacy index.');
    } finally {
        try {
            await mongoose.disconnect();
        } catch (e) {
            // ignore
        }
    }
}

run().then(() => process.exit(0)).catch((error) => {
    logger.error(`Academic session repair failed: ${error?.message || error}`);
    process.exit(1);
});
