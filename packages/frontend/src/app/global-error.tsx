'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Terjadi kesalahan</h2>
          <p>Mohon maaf, terjadi kesalahan sistem. Tim kami sudah diberitahu.</p>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
