"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UsePaginationOptions {
  initialLimit?: number;
  initialSortBy?: string;
  initialSortOrder?: "asc" | "desc";
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { initialLimit = 20, initialSortBy, initialSortOrder = "desc" } = options;

  const [page, setPage] = useState(1);
  const [limit] = useState(initialLimit);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const sortByRef = useRef(sortBy);
  sortByRef.current = sortBy;

  const handleSort = useCallback((field: string) => {
    if (sortByRef.current === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }, []);

  const updateFromResult = useCallback((result: { total: number; totalPages: number }) => {
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, []);

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    debouncedSearch,
    total,
    totalPages,
    setPage,
    setSearch,
    handleSort,
    updateFromResult,
  };
}
