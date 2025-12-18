import { join } from 'node:path';
import { config } from 'dotenv';

const { parsed } = config({
  path: join(__dirname, '.env'),
  quiet: true,
}) as any;

parsed.NODE_ENV = process.env.NODE_ENV || parsed.NODE_ENV;
export const env = parsed;
