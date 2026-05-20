import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(8080),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required().allow(''),
  DB_DATABASE: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  APP_URL: Joi.string().uri().default('http://localhost:8080'),
  APP_FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  SEED_STAFF_PASSWORD: Joi.string().optional(),
});

const DEFAULT_SECRET_PATTERNS = [
  'chalo_coffee_secret_key_change_in_production',
  'chalo_coffee_refresh_secret_change_in_production',
  'change_me',
  'change_in_production',
];

export function assertProductionSecrets(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;

  const jwtSecret = env.JWT_SECRET ?? '';
  const refreshSecret = env.JWT_REFRESH_SECRET ?? '';

  const isDefault = (secret: string): boolean =>
    DEFAULT_SECRET_PATTERNS.some((p) => secret.includes(p));

  if (isDefault(jwtSecret) || isDefault(refreshSecret)) {
    throw new Error(
      '[FATAL] Detected default JWT secret in production environment. ' +
      'Set JWT_SECRET and JWT_REFRESH_SECRET to strong random values before deploying.',
    );
  }

  if (jwtSecret === refreshSecret) {
    throw new Error(
      '[FATAL] JWT_SECRET and JWT_REFRESH_SECRET must be different.',
    );
  }
}
