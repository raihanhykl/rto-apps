/**
 * Sanitize and validate pagination query params.
 * Prevents OOM from unbounded limit and injection via sortBy.
 */
export function sanitizePaginationParams(
  query: Record<string, unknown>,
  allowedSortFields: string[] = [],
) {
  const page = Math.max(1, Math.min(1000, parseInt(String(query.page || '1'), 10) || 1));
  const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || '20'), 10) || 20));

  let sortBy = String(query.sortBy || 'createdAt');
  if (allowedSortFields.length > 0 && !allowedSortFields.includes(sortBy)) {
    sortBy = allowedSortFields[0] || 'createdAt';
  }

  let sortOrder: 'asc' | 'desc' = 'desc';
  if (query.sortOrder === 'asc') sortOrder = 'asc';

  const search = query.search ? String(query.search).slice(0, 200) : undefined;

  return { page, limit, sortBy, sortOrder, search };
}
