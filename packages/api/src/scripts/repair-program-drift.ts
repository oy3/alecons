import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProgramDriftService } from '../services/program-drift.service';

const logger = new Logger('RepairProgramDrift');

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

async function run() {
    const applyChanges = hasFlag('--apply');
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    try {
        const programDriftService = app.get(ProgramDriftService);
        const result = await programDriftService.inspectAndRepair({
            apply: applyChanges,
            sampleLimit: 20,
        });

        logger.log(
            `Summary: scanned=${result.scanned}, drifted=${result.drifted}, missingProgram=${result.missingProgram}, missingProgramConfig=${result.missingProgramConfig}`,
        );

        if (!applyChanges) {
            logger.warn('Dry-run mode complete. Re-run with --apply to persist fixes.');
            return;
        }

        logger.log(`Repair completed: matched=${result.matched || 0}, modified=${result.modified || 0}`);
    } finally {
        await app.close();
    }
}

run()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        logger.error(`Repair failed: ${error?.message || error}`);
        process.exit(1);
    });
