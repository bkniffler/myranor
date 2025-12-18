import { anthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

import { llmEnv } from './env';

export function createLLM(modelId?: string): LanguageModel {
  if (!llmEnv.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY fehlt. Setze ihn als Env-Var (z.B. in .env) um den LLM-Runner zu nutzen.',
    );
  }
  return anthropic(modelId ?? llmEnv.MYRANOR_ANTHROPIC_MODEL);
}
