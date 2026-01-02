import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

const DEFAULT_GOOGLE_MODEL = 'gemini-3-flash-preview';
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-5';

export function createLLM(modelId?: string | null): LanguageModel {
  const requested = (modelId ?? '').trim();

  // Prefix-based selection to keep CLI wiring simple.
  // Examples:
  // - google:gemini-3-flash-preview
  // - anthropic:claude-opus-4-5
  if (requested.startsWith('anthropic:')) {
    const id = requested.slice('anthropic:'.length).trim() || DEFAULT_ANTHROPIC_MODEL;
    return anthropic(id);
  }
  if (requested.startsWith('google:')) {
    const id = requested.slice('google:'.length).trim() || DEFAULT_GOOGLE_MODEL;
    return google(id);
  }

  // Heuristic: model name without prefix.
  if (requested.startsWith('claude')) return anthropic(requested);
  if (requested.startsWith('gemini')) return google(requested);

  // Default.
  return google(DEFAULT_GOOGLE_MODEL);
}
