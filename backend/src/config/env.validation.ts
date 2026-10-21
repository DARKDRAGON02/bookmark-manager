import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  FRONTEND_URL: z.url().default('http://localhost:5173'),

  BACKEND_PORT: z.coerce.number().int().positive().default(4000),

  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'REDIS_URL must start with redis:// or rediss://')
    .default('redis://localhost:6379'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),

  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),

  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email('FIREBASE_CLIENT_EMAIL must be a valid email'),

  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1, 'FIREBASE_PRIVATE_KEY is required')
    .transform((value) => value.replace(/\\n/g, '\n')),

  /**
   * Cloudflare clearance cookie for templetoons.com. The site sits behind a
   * bot challenge, so requests without it get the challenge page instead of
   * any chapter data. Expires quickly and is tied to the issuing browser's
   * IP and header fingerprint.
   */
  TEMPLETOONS_COOKIE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
