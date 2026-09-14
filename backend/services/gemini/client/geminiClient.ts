/**
 * @file geminiClient.ts
 * @description Client-side wrapper for AI chat interactions.
 * Conforms to < 200 lines limit.
 */

export class GeminiClient {
  public async prompt(text: string): Promise<string> {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
    });
    if (!res.ok) throw new Error(`AI generation failed: ${res.statusText}`);
    const data = await res.json();
    return data.text || '';
  }
}

export const geminiClient = new GeminiClient();
