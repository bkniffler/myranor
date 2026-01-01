import { z } from 'zod';

const envSchema = z.object({
  MYRANOR_PORT: z.coerce.number().int().positive().default(8080),
  MYRANOR_STORE_DIR: z.string().default('.ignore/store'),
  MYRANOR_DEV_AUTH: z
    .string()
    .optional()
    .transform((v) => (v ?? '1').toLowerCase())
    .transform((v) => !['0', 'false', 'no', 'off'].includes(v)),
});

export const env = envSchema.parse(process.env);
