/**
 * ASCII Architecture Flowchart: BaseApiRoute
 *
 *   ┌──────────────────────────────────────┐
 *   │       Initialize BaseApiRoute        │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

import { SkipoBase } from '@skipo/core';
import { RouteConfig } from './types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export abstract class BaseApiRoute extends SkipoBase {
  protected config: RouteConfig;

  constructor(config: RouteConfig = {}) {
    super({ name: 'BaseApiRoute' });
    this.config = config;
  }

  abstract handle(req: Request): Promise<Response>;

  protected success<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify({ data, status }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  protected error(message: string, status = 400): Response {
    return new Response(JSON.stringify({ error: message, status }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}