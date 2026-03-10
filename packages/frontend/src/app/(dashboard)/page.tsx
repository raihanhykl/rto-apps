"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { useDashboardStats } from "@/hooks/useApi";
import { DashboardStats } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Users,
  FileText,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Activity,
  Ban,
  XCircle,
} from "lucide-react";

const RevenueChart = dynamic(
  () => import("@/components/charts/RevenueChart").then((m) => m.RevenueChart),
  {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse bg-muted rounded" />,
  },
);

const StatusDistributionChart = dynamic(
  () =>
    import("@/components/charts/StatusDistributionChart").then(
      (m) => m.StatusDistributionChart,
    ),
  {
    ssr: false,
    loading: () => <div className="h-[280px] animate-pulse bg-muted rounded" />,
  },
);

export default function DashboardPage() {
  const { data: stats, isLoading: loading } = useDashboardStats() as { data: DashboardStats | undefined; isLoading: boolean };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Gagal memuat data dashboard.
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Active Contracts",
      value: stats.activeContracts,
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Overdue",
      value: stats.overdueContracts,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Cancelled",
      value: stats.cancelledContracts,
      icon: XCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Repossessed",
      value: stats.repossessedContracts,
      icon: Ban,
      color: "text-gray-600",
      bg: "bg-gray-50",
    },
    {
      title: "Completed",
      value: stats.completedContracts,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/5",
      isAmount: true,
    },
    {
      title: "Pending Revenue",
      value: formatCurrency(stats.pendingRevenue),
      icon: CreditCard,
      color: "text-orange-600",
      bg: "bg-orange-50",
      isAmount: true,
    },
    {
      title: "Total Contracts",
      value: stats.totalContracts,
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview sistem RTO WEDISON</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p
                    className={`text-2xl font-bold mt-1 ${stat.isAmount ? "text-lg" : ""}`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.bg} ${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pendapatan per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={stats.chartData.revenueByMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribusi Status Kontrak</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={stats.chartData.contractsByStatus} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aktivitas Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Belum ada aktivitas.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {activity.action}
                    </Badge>
                    <span className="text-sm">{activity.description}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
