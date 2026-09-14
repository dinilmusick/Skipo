/**
 * @file httpTransport.ts
 * @description HTTP Transport encoding, decoding, and dispatch for Gateway.
 * Conforms to APP_ARCHITECTURE_SPEC Section 17 & < 200 lines.
 */

export class HttpTransport {
  public encode(payload: unknown): string {
    return JSON.stringify(payload);
  }

  public async send(endpoint: string, encodedBody: string): Promise<Response> {
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: encodedBody,
    });
  }

  public async decode<T = unknown>(response: Response): Promise<T> {
    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Transport error [${response.status}]: ${errText}`);
    }
    return response.json() as Promise<T>;
  }
}

export const httpTransport = new HttpTransport();
