import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';

@Injectable()
export class ContentSanitizationService {
    private readonly logger = new Logger(ContentSanitizationService.name);
    private purify: any;

    constructor() {
        // Initialize DOMPurify with JSDOM
        const window = new JSDOM('').window;
        // Import DOMPurify dynamically to handle CommonJS/ES module issues
        const createDOMPurify = require('dompurify');
        this.purify = createDOMPurify(window as any);

        // Configure allowed tags and attributes for educational content
        this.configurePurify();
    }

    private configurePurify() {
        // Allow educational content tags
        this.purify.addHook('beforeSanitizeElements', (node: any) => {
            // Allow MathJax/KaTeX formula elements
            if (node.tagName && node.tagName.toLowerCase() === 'annotation') {
                return node;
            }
        });
    }

    /**
     * Sanitize HTML content while preserving educational elements
     */
    sanitizeHtml(content: string): string {
        if (!content || typeof content !== 'string') {
            return '';
        }

        try {
            const sanitized = this.purify.sanitize(content, {
                ALLOWED_TAGS: [
                    'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li',
                    'blockquote', 'pre', 'code',
                    'img', 'a',
                    'sub', 'sup',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    // MathJax/KaTeX elements
                    'math', 'mrow', 'mi', 'mo', 'mn', 'mfrac', 'msup', 'msub', 'mroot', 'msqrt',
                    'semantics', 'annotation', 'annotation-xml'
                ],
                ALLOWED_ATTR: [
                    'class', 'id', 'style',
                    'src', 'alt', 'width', 'height', 'title',
                    'href', 'target', 'rel',
                    'colspan', 'rowspan',
                    // MathJax/KaTeX attributes
                    'xmlns', 'display', 'encoding'
                ],
                ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                KEEP_CONTENT: true,
                ALLOW_DATA_ATTR: false
            });

            this.logger.debug(`Sanitized content: ${content.length} -> ${sanitized.length} characters`);
            return sanitized;
        } catch (error) {
            this.logger.error('Error sanitizing HTML content', error);
            // Return plain text as fallback
            return this.extractTextContent(content);
        }
    }

    /**
     * Extract plain text from HTML content
     */
    extractTextContent(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        try {
            const sanitized = this.purify.sanitize(html, { ALLOWED_TAGS: [] });
            return sanitized.trim();
        } catch (error) {
            this.logger.error('Error extracting text content', error);
            return html.replace(/<[^>]*>/g, '').trim();
        }
    }

    /**
     * Validate content length after text extraction
     */
    validateContentLength(content: string, maxLength: number = 100000): { isValid: boolean; textLength: number; error?: string } {
        // For rich content, we check the total HTML length rather than just text
        const totalLength = content.length;

        if (totalLength > maxLength) {
            return {
                isValid: false,
                textLength: totalLength,
                error: `Content exceeds maximum length of ${maxLength} characters (current: ${totalLength})`
            };
        }

        return {
            isValid: true,
            textLength: totalLength
        };
    }

    /**
     * Extract and validate embedded images
     */
    extractEmbeddedImages(content: string): string[] {
        if (!content) return [];

        const imageUrls: string[] = [];
        const imgRegex = /<img[^>]+src="([^"]+)"/gi;
        let match;

        while ((match = imgRegex.exec(content)) !== null) {
            const src = match[1];
            if (src.startsWith('data:image/')) {
                // Base64 embedded image
                imageUrls.push(src);
            } else if (src.startsWith('http')) {
                // External image URL
                imageUrls.push(src);
            }
        }

        return imageUrls;
    }

    /**
     * Extract mathematical formulas from content
     */
    extractFormulas(content: string): string[] {
        if (!content) return [];

        const formulas: string[] = [];

        // Extract KaTeX formulas
        const katexRegex = /<span class="ql-formula"[^>]*data-value="([^"]+)"/gi;
        let match;

        while ((match = katexRegex.exec(content)) !== null) {
            formulas.push(match[1]);
        }

        return formulas;
    }

    /**
     * Comprehensive content validation for questions
     */
    validateQuestionContent(content: string): {
        isValid: boolean;
        sanitizedContent: string;
        warnings: string[];
        metadata: any
    } {
        const warnings: string[] = [];
        const metadata: any = {};

        // Sanitize content
        const sanitizedContent = this.sanitizeHtml(content);

        // Validate length
        const lengthValidation = this.validateContentLength(sanitizedContent);
        if (!lengthValidation.isValid) {
            return {
                isValid: false,
                sanitizedContent,
                warnings: [lengthValidation.error!],
                metadata
            };
        }

        // Extract embedded content
        const images = this.extractEmbeddedImages(sanitizedContent);
        const formulas = this.extractFormulas(sanitizedContent);

        metadata.imageCount = images.length;
        metadata.formulaCount = formulas.length;
        metadata.textLength = lengthValidation.textLength;

        // Validate image count and size
        if (images.length > 5) {
            warnings.push('Question contains more than 5 images. Consider reducing for better performance.');
        }

        // Check for overly complex content
        if (formulas.length > 10) {
            warnings.push('Question contains many formulas. Ensure they render correctly.');
        }

        return {
            isValid: true,
            sanitizedContent,
            warnings,
            metadata
        };
    }
}