import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

// Load .env before reading SENTRY_DSN (this runs before config/index.ts)
dotenv.config();

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.info('Sentry DSN not configured — error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      // Don't send events in test environment
      if (process.env.NODE_ENV === 'test') return null;
      return event;
    },
  });

  console.info('Sentry error monitoring initialized');
}

export { Sentry };
