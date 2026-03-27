import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Zod schema for environment variable validation
const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default('3001')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 65535, {
      message: 'PORT must be a valid number between 1 and 65535',
    }),
  CORS_ORIGIN: z.string().optional().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  DATABASE_URL: z.string().optional().default(''),
});

// Parse and validate env vars
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// In production, DATABASE_URL is required — crash early
if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required in production environment');
  process.exit(1);
}

export const config = {
  port: parseInt(env.PORT, 10),
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
};
