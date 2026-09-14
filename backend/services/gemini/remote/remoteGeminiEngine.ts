/**
 * @file remoteGeminiEngine.ts
 * @description Remote Google Gemini Execution Driver.
 * Conforms to APP_ARCHITECTURE_SPEC Section 17 & Inviolable Law L3.
 */

export class RemoteGeminiEngine {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  public async generateContent(prompt: string, model: string = 'gemini-2.5-flash'): Promise<{ text: string }> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error [${res.status}]: ${res.statusText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text: candidate };
  }

  public async streamContent(prompt: string, model: string = 'gemini-2.5-flash'): Promise<ReadableStream> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Gemini Stream error: ${res.statusText}`);
    }
    return res.body;
  }
}

export const remoteGeminiEngine = new RemoteGeminiEngine();
