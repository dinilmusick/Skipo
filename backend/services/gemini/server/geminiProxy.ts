/**
 * @file geminiProxy.ts
 * @description Local server proxy for Gemini requests.
 * Conforms to < 200 lines limit.
 */

import { remoteGeminiEngine } from '../remote/remoteGeminiEngine';
import { chatRepository } from '../repositories/chatRepository';

export class GeminiProxy {
  public async generate(prompt: string, model: string) {
    const result = await remoteGeminiEngine.generateContent(prompt, model);
    await chatRepository.recordMessage('user', prompt);
    await chatRepository.recordMessage('model', result.text);
    return result;
  }
}

export const geminiProxy = new GeminiProxy();
