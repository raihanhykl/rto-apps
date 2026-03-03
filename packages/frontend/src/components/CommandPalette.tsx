"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  Search,
  Users,
  FileText,
  Receipt,
  LayoutDashboard,
  Settings,
  ClipboardList,
  BarChart3,
} from "lucide-react";

interface SearchResult {
  type: "page" | "customer" | "contract";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const PAGES: SearchResult[] = [
  { type: "page", id: "dashboard", title: "Dashboard", href: "/", subtitle: "Overview" },
  { type: "page", id: "customers", title: "Customers", href: "/customers", subtitle: "Kelola customer" },
  { type: "page", id: "contracts", title: "Contracts", href: "/contracts", subtitle: "Kelola kontrak" },
  { type: "page", id: "invoices", title: "Invoices", href: "/invoices", subtitle: "Daftar invoice" },
  { type: "page", id: "reports", title: "Reports", href: "/reports", subtitle: "Laporan" },
  { type: "page", id: "audit", title: "Audit Log", href: "/audit", subtitle: "Riwayat aktivitas" },
  { type: "page", id: "settings", title: "Settings", href: "/settings", subtitle: "Pengaturan" },
];

const getIcon = (result: SearchResult) => {
  if (result.type === "customer") return Users;
  if (result.type === "contract") return FileText;
  switch (result.id) {
    case "dashboard": return LayoutDashboard;
    case "customers": return Users;
    case "contracts": return FileText;
    case "invoices": return Receipt;
    case "reports": return BarChart3;
    case "audit": return ClipboardList;
    case "settings": return Settings;
    default: return Search;
  }
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(PAGES);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGES);
      setSelectedIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const pageResults = PAGES.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.subtitle || "").toLowerCase().includes(q)
    );

    const fetchData = async () => {
      const items: SearchResult[] = [...pageResults];
      try {
        const [customers, contracts] = await Promise.all([
          api.getCustomers(query),
          api.getContracts(),
        ]);
        customers.slice(0, 5).forEach((c: any) => {
          items.push({
            type: "customer",
            id: c.id,
            title: c.fullName,
            subtitle: c.phone,
            href: `/customers/${c.id}`,
          });
        });
        contracts
          .filter((c: any) =>
            c.contractNumber.toLowerCase().includes(q) ||
            c.motorModel.toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((c: any) => {
            items.push({
              type: "contract",
              id: c.id,
              title: c.contractNumber,
              subtitle: `${c.motorModel} - ${c.status}`,
              href: `/contracts/${c.id}`,
            });
          });
      } catch {
        // ignore
      }
      setResults(items);
      setSelectedIndex(0);
    };

    const timer = setTimeout(fetchData, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = (result: SearchResult) => {
    router.push(result.href);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl border overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman, customer, kontrak..."
            className="border-0 shadow-none focus-visible:ring-0 h-12"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Tidak ditemukan.</p>
          ) : (
            results.map((result, index) => {
              const Icon = getIcon(result);
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                    index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                  onClick={() => navigate(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize shrink-0">{result.type}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
