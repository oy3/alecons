export interface BulkImportJobData {
    examId: string;
    uploadedBy: string;
    filename: string;
    fileBuffer: Buffer;
    format: string;
}