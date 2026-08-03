import { BadRequestException, Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { ProgramDocument } from '../schemas/program.schema';

type ProgramRelationLookup = {
    _id: Types.ObjectId;
    active?: boolean;
    programTypeId?: Types.ObjectId;
    programModeId?: Types.ObjectId;
};

type ResolveProgramSelectionOptions = {
    programModel: Model<ProgramDocument>;
    programId: string;
    providedProgramTypeId?: string;
    providedProgramModeId?: string;
    logger?: Logger;
    logContext?: Record<string, unknown>;
};

export type ResolvedProgramSelection = {
    program: ProgramRelationLookup;
    programId: string;
    programObjectId: Types.ObjectId;
    programTypeId: string;
    programModeId: string;
};

export async function resolveProgramSelection(
    options: ResolveProgramSelectionOptions,
): Promise<ResolvedProgramSelection> {
    const program = await options.programModel
        .findById(options.programId)
        .select('_id active programTypeId programModeId')
        .lean<ProgramRelationLookup | null>();

    if (!program || !program.active) {
        throw new BadRequestException('Invalid program selected');
    }

    const resolvedProgramTypeId = program.programTypeId?.toString?.();
    const resolvedProgramModeId = program.programModeId?.toString?.();

    if (!resolvedProgramTypeId || !resolvedProgramModeId) {
        throw new BadRequestException('Selected program is missing type or mode configuration');
    }

    if (
        options.logger &&
        ((options.providedProgramTypeId && options.providedProgramTypeId !== resolvedProgramTypeId) ||
            (options.providedProgramModeId && options.providedProgramModeId !== resolvedProgramModeId))
    ) {
        options.logger.warn(
            'Submitted program type/mode does not match selected program; normalizing to program configuration',
            {
                programId: options.programId,
                providedProgramTypeId: options.providedProgramTypeId,
                providedProgramModeId: options.providedProgramModeId,
                resolvedProgramTypeId,
                resolvedProgramModeId,
                ...(options.logContext || {}),
            },
        );
    }

    return {
        program,
        programId: program._id.toString(),
        programObjectId: new Types.ObjectId(program._id),
        programTypeId: resolvedProgramTypeId,
        programModeId: resolvedProgramModeId,
    };
}

export function getNestedProgramRelation(entity: { programId?: any } | null | undefined) {
    const program = entity?.programId || null;

    return {
        program,
        programType: program?.programTypeId || null,
        programMode: program?.programModeId || null,
    };
}