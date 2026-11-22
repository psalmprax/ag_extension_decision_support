import apiClient from './client';

/** A list response: `{ data: { <items key>: T[], total } }`. */
type ListResponse<K extends string, T> = { success: boolean; data: Record<K, T[]> & { total: number } };

/**
 * Every item of a list endpoint, read page by page. A single request returned only the
 * first page (50 farmers, 50 visits, 20 reports), so the rest never showed. Stops at
 * `ceiling` items: a list longer than that needs search, not one screen.
 */
export async function fetchAllPages<K extends string, T>(
  path: string,
  key: K,
  { pageSize, ceiling, params = {} }: { pageSize: number; ceiling: number; params?: Record<string, unknown> },
): Promise<ListResponse<K, T>> {
  const items: T[] = [];
  let first: ListResponse<K, T> | null = null;
  for (let offset = 0; offset < ceiling; offset += pageSize) {
    const { data } = await apiClient.get<ListResponse<K, T>>(path, { params: { ...params, limit: pageSize, offset } });
    first ??= data;
    const page = data.data?.[key] ?? [];
    items.push(...page);
    if (page.length < pageSize || items.length >= (data.data?.total ?? 0)) break;
  }
  if (!first) throw new Error(`No list received from ${path}`);
  return { ...first, data: { ...first.data, [key]: items, total: first.data?.total ?? items.length } };
}
