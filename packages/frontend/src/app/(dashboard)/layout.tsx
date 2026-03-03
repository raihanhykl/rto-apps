"use client";

import { Sidebar } from "@/components/Sidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { CommandPalette } from "@/components/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <CommandPalette />
        <main className="pt-14 px-4 pb-4 lg:ml-64 lg:pt-6 lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
