'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface StatusDistributionChartProps {
  data: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#3b82f6',
  COMPLETED: '#22c55e',
  OVERDUE: '#ef4444',
  CANCELLED: '#a1a1aa',
  REPOSSESSED: '#6b7280',
};

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const chartData = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
        Belum ada data kontrak.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, 'Kontrak']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
