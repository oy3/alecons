import { Injectable } from '@nestjs/common';

@Injectable()
export class MatriculationService {

    /**
     * Generate matriculation number in format: ALC/{YY}/{program.code}-nnnn
     * Example: ALC/25/01-0001
     */
    generateMatriculationNumber(programCode: string, year?: number): string {
        const currentYear = year || new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2); // Get last 2 digits

        // Generate a 4-digit sequential number (this should be fetched from DB for uniqueness)
        // For now, we'll use a timestamp-based approach, but in production this should be properly sequenced
        const timestamp = Date.now();
        const sequence = (timestamp % 10000).toString().padStart(4, '0');

        return `ALC/${yearSuffix}/${programCode}-${sequence}`;
    }

    /**
     * Validate matriculation number format
     */
    validateMatriculationNumber(matricNumber: string): boolean {
        const pattern = /^ALC\/\d{2}\/\d{2}-\d{4}$/;
        return pattern.test(matricNumber);
    }

    /**
     * Extract components from matriculation number
     */
    parseMatriculationNumber(matricNumber: string): {
        year: string;
        programCode: string;
        sequence: string;
    } | null {
        if (!this.validateMatriculationNumber(matricNumber)) {
            return null;
        }

        const parts = matricNumber.split('/');
        const [, year] = parts;
        const [programCode, sequence] = parts[2].split('-');

        return {
            year,
            programCode,
            sequence
        };
    }
}