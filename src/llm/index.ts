import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

const models = {
  anthropic: anthropic('claude-opus-4-5'),
  google: google('gemini-3-flash-preview'),
};

export function createLLM(): LanguageModel {
  return models.google;
}
