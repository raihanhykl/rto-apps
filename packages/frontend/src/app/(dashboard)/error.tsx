'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Terjadi Kesalahan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman tidak dapat ditampilkan. Silakan coba lagi.
        </p>
        {error?.message && (
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">{error.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="outline" asChild>
          <a href="/">Kembali ke Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
