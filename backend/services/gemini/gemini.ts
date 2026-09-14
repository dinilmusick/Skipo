/**
 * @file gemini.ts
 * @description Google Gemini AI Service Facade.
 * Conforms to APP_ARCHITECTURE_SPEC Sections 5 & 6 (runtime=server, deployment=remote).
 */

import type { Runtime, Deployment } from '@skipo/backend';
import { remoteGeminiEngine } from './remote/remoteGeminiEngine';
import { geminiProxy } from './server/geminiProxy';

export const runtime: Runtime = 'server';
export const deployment: Deployment = 'remote';

export const service = {
  name: 'gemini',
  runtime,
  deployment,
  generateText: async (prompt: string, model: string = 'gemini-2.5-flash') => {
    if (deployment === 'local') {
      return geminiProxy.generate(prompt, model);
    }
    return remoteGeminiEngine.generateContent(prompt, model);
  },
  streamText: async (prompt: string, model: string = 'gemini-2.5-flash') => {
    return remoteGeminiEngine.streamContent(prompt, model);
  },
};
