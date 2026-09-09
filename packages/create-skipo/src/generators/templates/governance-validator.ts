/**
 * @fileoverview API Governance Request Validator Template
 */

export const governanceValidatorTemplate = () => `import { NextRequest, NextResponse } from 'next/server';
import { RequestSchema } from './types';

export function validateContentLength(req: NextRequest, maxSizeBytes: number): NextResponse | null {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const len = parseInt(contentLengthHeader, 10);
    if (!isNaN(len) && len > maxSizeBytes) {
      return NextResponse.json(
        { error: 'Payload Too Large', message: \`Payload exceeds \${maxSizeBytes} bytes limit\` },
        { status: 413 }
      );
    }
  }
  return null;
}

export function validateContentType(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers.get('content-type') || '';
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Unsupported Media Type', message: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }
  }
  return null;
}

export function validateQueryLength(req: NextRequest, maxQueryLength = 2048): NextResponse | null {
  const search = req.nextUrl.search;
  if (search && search.length > maxQueryLength) {
    return NextResponse.json(
      { error: 'URI Too Long', message: 'Query string exceeds maximum allowed length' },
      { status: 413 }
    );
  }
  return null;
}

export function validateSchema(body: any, schema?: RequestSchema): string | null {
  if (!schema) return null;
  if (schema.requiredFields) {
    for (const field of schema.requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return \`Missing required field: \${field}\`;
      }
    }
  }
  if (schema.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (body[field] !== undefined && typeof body[field] !== expectedType) {
        return \`Field '\${field}' must be of type \${expectedType}\`;
      }
    }
  }
  return null;
}
`;
