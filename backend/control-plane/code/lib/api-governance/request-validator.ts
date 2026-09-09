// ══════════════════════════════════════════════════════════════════════════════════════════
// REQUEST VALIDATION PIPELINE (GATE 1)
// ══════════════════════════════════════════════════════════════════════════════════════════
// Implements Section 5 of the API Security & Resource Governance Spec:
// - method_invalid => 405
// - content_type_invalid => 415
// - body_size > maxBodySize => 413
// - query_size > maxQuerySize => 413
// - body !~ schema || query !~ schema || params !~ schema => 422

import { NextRequest, NextResponse } from 'next/server';
import { RouteConfig } from './types';
import { DEFAULT_RESOURCE_LIMITS } from './resource-budget';

export interface ValidationSuccess<TBody = any> {
  valid: true;
  body: TBody;
  query: URLSearchParams;
  params: Record<string, string>;
}

export interface ValidationFailure {
  valid: false;
  response: NextResponse;
}

export type ValidationResult<TBody = any> = ValidationSuccess<TBody> | ValidationFailure;

/**
 * Validates request method, content-type, payload size, query length, and schema.
 */
export async function validateIncomingRequest<TBody = any>(
  req: NextRequest,
  config: RouteConfig<TBody>,
  rawParams?: Record<string, string>
): Promise<ValidationResult<TBody>> {
  // 1. Method Validation
  if (req.method !== config.method) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} is not allowed for ${config.id}. Expected ${config.method}.`,
        },
        {
          status: 405,
          headers: { Allow: config.method },
        }
      ),
    };
  }

  // 2. Query Size Validation
  const searchParams = req.nextUrl.searchParams;
  const queryString = req.nextUrl.search;
  const maxQuerySize = config.limits?.maxQuerySize ?? DEFAULT_RESOURCE_LIMITS.maxQuerySize;
  if (queryString.length > maxQuerySize) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'QUERY_STRING_TOO_LARGE',
          message: `Query parameter string exceeds maximum allowed limit of ${maxQuerySize} bytes.`,
        },
        { status: 413 }
      ),
    };
  }

  // 3. Path Parameters Validation
  const params = rawParams || {};
  const maxParamSize = config.limits?.maxParameterSize ?? DEFAULT_RESOURCE_LIMITS.maxParameterSize;
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string' && val.length > maxParamSize) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'PARAMETER_TOO_LARGE',
            message: `Path parameter "${key}" exceeds maximum limit of ${maxParamSize} bytes.`,
          },
          { status: 400 }
        ),
      };
    }
  }

  // 4. Content-Type and Body Size Check for mutation methods
  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method);
  let parsedBody: any = null;

  if (hasBody) {
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    const maxBodySize = config.limits?.maxBodySize ?? DEFAULT_RESOURCE_LIMITS.maxBodySize;

    if (contentLength > maxBodySize) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: `Request body size (${contentLength} bytes) exceeds limit of ${maxBodySize} bytes.`,
          },
          { status: 413 }
        ),
      };
    }

    const contentType = req.headers.get('content-type') || '';

    // If Content-Type provided, enforce application/json or multipart/form-data
    if (contentType) {
      const isJson = contentType.includes('application/json');
      const isFormData = contentType.includes('multipart/form-data');

      if (!isJson && !isFormData) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              success: false,
              error: 'UNSUPPORTED_MEDIA_TYPE',
              message: `Content-Type "${contentType}" is unsupported. Expected "application/json".`,
            },
            { status: 415 }
          ),
        };
      }
    }

    // If body content length > 0 or chunked, check content-type
    if (contentLength > 0 || req.headers.has('transfer-encoding')) {
      const isJson = contentType.includes('application/json');
      const isFormData = contentType.includes('multipart/form-data');


      if (isJson) {
        try {
          const rawText = await req.text();
          if (rawText.length > maxBodySize) {
            return {
              valid: false,
              response: NextResponse.json(
                {
                  success: false,
                  error: 'PAYLOAD_TOO_LARGE',
                  message: `Parsed body exceeds maximum limit of ${maxBodySize} bytes.`,
                },
                { status: 413 }
              ),
            };
          }
          parsedBody = rawText.trim().length > 0 ? JSON.parse(rawText) : {};
        } catch (err: any) {
          return {
            valid: false,
            response: NextResponse.json(
              {
                success: false,
                error: 'INVALID_JSON_BODY',
                message: 'Failed to parse JSON payload. Malformed JSON.',
              },
              { status: 400 }
            ),
          };
        }
      }
    }
  }

  // 5. Schema Validation (Body, Query, Params)
  if (config.inputSchema) {
    if (config.inputSchema.query) {
      const queryCheck = config.inputSchema.query(searchParams);
      if (!queryCheck.valid) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              success: false,
              error: 'QUERY_VALIDATION_FAILED',
              message: queryCheck.error || 'Query parameters failed schema validation.',
            },
            { status: 422 }
          ),
        };
      }
    }

    if (config.inputSchema.params) {
      const paramsCheck = config.inputSchema.params(params);
      if (!paramsCheck.valid) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              success: false,
              error: 'PARAMS_VALIDATION_FAILED',
              message: paramsCheck.error || 'Path parameters failed schema validation.',
            },
            { status: 422 }
          ),
        };
      }
    }

    if (config.inputSchema.body && parsedBody !== null) {
      const bodyCheck = config.inputSchema.body(parsedBody);
      if (!bodyCheck.valid) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              success: false,
              error: 'BODY_VALIDATION_FAILED',
              message: bodyCheck.error || 'Request body failed schema validation.',
            },
            { status: 422 }
          ),
        };
      }
    }
  }

  return {
    valid: true,
    body: parsedBody,
    query: searchParams,
    params,
  };
}
