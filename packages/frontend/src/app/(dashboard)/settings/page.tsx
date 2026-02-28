"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Setting } from "@/types";
import { Settings, Save } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      const values: Record<string, string> = {};
      data.forEach((s: Setting) => {
        values[s.key] = s.value;
      });
      setEditValues(values);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

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
      await loadSettings();
    } catch (error) {
      console.error("Failed to save setting:", error);
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
          {settings.map((setting) => (
            <div key={setting.key} className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label className="capitalize">
                  {setting.key.replace(/_/g, " ")}
                </Label>
                <p className="text-xs text-muted-foreground">{setting.description}</p>
                <Input
                  value={editValues[setting.key] || ""}
                  onChange={(e) =>
                    setEditValues({ ...editValues, [setting.key]: e.target.value })
                  }
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  saving === setting.key || editValues[setting.key] === setting.value
                }
                onClick={() => handleSave(setting)}
              >
                <Save className="h-4 w-4 mr-1" />
                {saving === setting.key ? "..." : "Simpan"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
