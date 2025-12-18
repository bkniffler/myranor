import { z } from 'zod';

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

const llmEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  MYRANOR_ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-opus-4-5'),
  MYRANOR_LLM_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(400),
  MYRANOR_LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2),
  MYRANOR_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  MYRANOR_LLM_DEBUG: z
    .string()
    .optional()
    .transform((v) => parseBool(v, false)),
});

export type LlmEnv = z.infer<typeof llmEnvSchema>;

export const llmEnv: LlmEnv = llmEnvSchema.parse(process.env);
