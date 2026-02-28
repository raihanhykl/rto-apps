"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { AuditLog } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

const actionColor = (action: string) => {
  switch (action) {
    case "CREATE": return "default" as const;
    case "UPDATE": return "secondary" as const;
    case "DELETE": return "destructive" as const;
    case "LOGIN": return "success" as const;
    case "LOGOUT": return "outline" as const;
    case "PAYMENT": return "warning" as const;
    case "EXPORT": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Riwayat semua aktivitas sistem</p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Belum ada aktivitas tercatat.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 text-sm font-medium">Waktu</th>
                    <th className="text-left p-4 text-sm font-medium">Action</th>
                    <th className="text-left p-4 text-sm font-medium">Module</th>
                    <th className="text-left p-4 text-sm font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="p-4">
                        <Badge variant={actionColor(log.action)}>{log.action}</Badge>
                      </td>
                      <td className="p-4 text-sm capitalize">{log.module}</td>
                      <td className="p-4 text-sm">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
