/**
 * Validation Utilities
 * Functions for validating form inputs and patterns
 */

/**
 * RFC 5322 compliant email validation
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Basic email pattern - not fully RFC 5322 compliant but practical
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Additional checks
  if (email.length > 254) return false; // Max email length
  if (email.startsWith('.') || email.endsWith('.')) return false;
  if (email.includes('..')) return false;

  return emailPattern.test(email);
}

/**
 * Validate multiple email addresses (comma or semicolon separated)
 * Returns { valid: boolean, emails: string[], invalid: string[] }
 */
export function validateMultipleEmails(input: string): {
  valid: boolean;
  emails: string[];
  invalid: string[];
} {
  if (!input || typeof input !== 'string') {
    return { valid: true, emails: [], invalid: [] };
  }

  // Split by comma or semicolon, handle angle bracket format
  const parts = input.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];

  for (const part of parts) {
    // Extract email from "Name <email>" format
    const angleMatch = part.match(/<([^>]+)>/);
    const email = angleMatch ? angleMatch[1].trim() : part;

    if (validateEmail(email)) {
      emails.push(email);
    } else {
      invalid.push(part);
    }
  }

  return {
    valid: invalid.length === 0,
    emails,
    invalid,
  };
}

/**
 * Validate wildcard pattern (supports * and ?)
 * Returns true if pattern is valid
 */
export function validateWildcardPattern(pattern: string): boolean {
  if (!pattern || typeof pattern !== 'string') return false;

  // Check for invalid characters (basic security)
  const invalidChars = /[<>{}[\]\\]/;
  if (invalidChars.test(pattern)) return false;

  // Check for consecutive wildcards (optimization)
  if (pattern.includes('**') || pattern.includes('??')) return false;

  // Pattern should not be just wildcards
  if (/^[\*\?]+$/.test(pattern)) return false;

  // Pattern length check
  if (pattern.length > 500) return false;

  return true;
}

/**
 * Match a value against a wildcard pattern
 * Supports * (any characters) and ? (single character)
 */
export function matchWildcard(value: string, pattern: string, caseInsensitive = true): boolean {
  if (!value || !pattern) return false;

  const flags = caseInsensitive ? 'i' : '';

  // Escape special regex characters except * and ?
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${escaped}$`, flags);
  return regex.test(value);
}

/**
 * Validate required field (non-empty)
 */
export function validateRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validate string length
 */
export function validateLength(value: string, min?: number, max?: number): boolean {
  if (typeof value !== 'string') return false;
  const len = value.length;
  if (min !== undefined && len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
}

/**
 * Validate number range
 */
export function validateRange(value: number, min?: number, max?: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitize input by removing potentially dangerous characters
 */
export function sanitizeInput(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Validate file type by extension or MIME type
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  return allowedTypes.some(
    (type) =>
      type.toLowerCase() === extension ||
      type.toLowerCase() === mimeType ||
      mimeType.startsWith(type.toLowerCase().replace('/*', '/'))
  );
}
