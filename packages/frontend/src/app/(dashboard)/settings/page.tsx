'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings, useInvalidate } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { Setting } from '@/types';
import { Settings, Save, Play, Clock, Loader2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/stores/toastStore';

export default function SettingsPage() {
  const invalidate = useInvalidate();
  const { data: settings = [] as Setting[], isLoading: loading } = useSettings();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Scheduler state
  const [jobRunning, setJobRunning] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<string | null>(null);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const status = await api.getSchedulerStatus();
      setLastRunAt(status.lastRunAt);
      setLastRunResult(status.lastRunResult);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSchedulerStatus();
  }, [fetchSchedulerStatus]);

  const handleRunDailyTasks = async () => {
    setJobRunning(true);
    try {
      const result = await api.runDailyTasks();
      if (result.success) {
        toastSuccess('Berhasil', result.message);
      } else {
        toastError('Gagal', result.message);
      }
      await fetchSchedulerStatus();
      // 30 second cooldown
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
    } catch (error: any) {
      toastError('Gagal', error?.message || 'Gagal menjalankan daily tasks.');
    } finally {
      setJobRunning(false);
    }
  };

  useEffect(() => {
    if (settings && (settings as Setting[]).length > 0) {
      const values: Record<string, string> = {};
      (settings as Setting[]).forEach((s: Setting) => {
        values[s.key] = s.value;
      });
      setEditValues(values);
    }
  }, [settings]);

  const handleSave = async (setting: Setting) => {
    const newValue = editValues[setting.key];
    if (newValue === setting.value) return;

    setSaving(setting.key);
    try {
      await api.updateSetting({
        key: setting.key,
        value: newValue,
        description: setting.description,
      });
      invalidate('/settings');
    } catch (error) {
      console.error('Failed to save setting:', error);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Pengaturan sistem</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Konfigurasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[...(settings as Setting[])]
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((setting) => (
              <div key={setting.key} className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="capitalize">{setting.key.replace(/_/g, ' ')}</Label>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                  <Input
                    value={editValues[setting.key] || ''}
                    onChange={(e) =>
                      setEditValues({ ...editValues, [setting.key]: e.target.value })
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving === setting.key || editValues[setting.key] === setting.value}
                  onClick={() => handleSave(setting)}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saving === setting.key ? '...' : 'Simpan'}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Job Harian (Scheduler)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Job harian berjalan otomatis setiap jam 00:01 WIB. Gunakan tombol di bawah untuk
            menjalankan secara manual (idempotent — aman dijalankan berulang kali).
          </p>
          <div className="flex items-center gap-4">
            <Button onClick={handleRunDailyTasks} disabled={jobRunning || cooldown}>
              {jobRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menjalankan...
                </>
              ) : cooldown ? (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Cooldown...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Jalankan Job Harian
                </>
              )}
            </Button>
            {lastRunAt && (
              <span className="text-sm text-muted-foreground">
                Terakhir:{' '}
                {new Date(lastRunAt).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                —{' '}
                {lastRunResult === 'success'
                  ? '✓ Berhasil'
                  : lastRunResult === 'error'
                    ? '✗ Error'
                    : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
