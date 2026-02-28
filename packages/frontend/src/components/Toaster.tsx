"use client";

import { useToastStore } from "@/stores/toastStore";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5 fade-in-0 bg-card",
            t.variant === "destructive" && "border-destructive/50 text-destructive",
            t.variant === "success" && "border-success/50"
          )}
        >
          {t.variant === "success" && <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />}
          {t.variant === "destructive" && <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
          {t.variant === "default" && <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && (
              <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 rounded-sm opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
