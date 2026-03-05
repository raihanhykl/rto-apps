"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCalendarData } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface CalendarDay {
  date: string;
  status: "paid" | "pending" | "overdue" | "holiday" | "not_issued";
  amount?: number;
}

interface PaymentCalendarProps {
  contractId: string;
  billingStartDate: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  paid: { bg: "bg-green-500", text: "text-white", label: "Sudah Bayar" },
  pending: { bg: "bg-yellow-400", text: "text-yellow-900", label: "Belum Bayar" },
  overdue: { bg: "bg-red-500", text: "text-white", label: "Terlambat" },
  holiday: { bg: "bg-blue-400", text: "text-white", label: "Libur Bayar" },
  not_issued: { bg: "bg-gray-200 dark:bg-gray-700", text: "text-gray-400 dark:text-gray-500", label: "Belum Terbit" },
};

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function PaymentCalendar({ contractId, billingStartDate }: PaymentCalendarProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);

  const { data: calendarData, isLoading: loading } = useCalendarData(
    billingStartDate ? contractId : undefined,
    year,
    month
  );
  const days = (calendarData as CalendarDay[]) || [];

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToToday = () => {
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1);
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build dayMap for quick lookup
  const dayMap = new Map<number, CalendarDay>();
  days.forEach((d) => {
    const dayNum = parseInt(d.date.split("-")[2], 10);
    dayMap.set(dayNum, d);
  });

  // Count stats
  const stats = { paid: 0, pending: 0, overdue: 0, holiday: 0, not_issued: 0 };
  days.forEach((d) => {
    if (d.status in stats) stats[d.status as keyof typeof stats]++;
  });

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;
  const todayDate = new Date().getDate();

  if (!billingStartDate) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Kalender Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Kalender pembayaran akan tersedia setelah unit diterima dan billing dimulai.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Kalender Pembayaran
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToToday}
              className="text-sm font-medium px-3 py-1 rounded-md hover:bg-muted transition-colors min-w-[140px] text-center"
            >
              {MONTH_NAMES[month - 1]} {year}
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-9 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map((name) => (
                <div key={name} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before the 1st */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayData = dayMap.get(dayNum);
                const status = dayData?.status || "not_issued";
                const colors = STATUS_COLORS[status];
                const isToday = isCurrentMonth && dayNum === todayDate;

                return (
                  <div
                    key={dayNum}
                    className={`
                      h-9 rounded-md flex items-center justify-center text-xs font-medium cursor-default
                      transition-all ${colors.bg} ${colors.text}
                      ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                    `}
                    onMouseEnter={() => dayData && setHoveredDay(dayData)}
                    onMouseLeave={() => setHoveredDay(null)}
                    title={`${dayNum} ${MONTH_NAMES[month - 1]} - ${colors.label}${dayData?.amount ? ` (${formatCurrency(dayData.amount)})` : ""}`}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>

            {/* Hover tooltip */}
            {hoveredDay && (
              <div className="mt-2 text-xs text-center text-muted-foreground">
                {hoveredDay.date} — {STATUS_COLORS[hoveredDay.status]?.label}
                {hoveredDay.amount ? ` — ${formatCurrency(hoveredDay.amount)}` : ""}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
              {Object.entries(STATUS_COLORS).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div className={`h-3 w-3 rounded-sm ${val.bg}`} />
                  <span className="text-muted-foreground">{val.label}</span>
                  <span className="font-medium">({stats[key as keyof typeof stats] || 0})</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
