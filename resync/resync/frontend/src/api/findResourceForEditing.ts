import { api } from './client';
import type { Resource } from './types';

/**
 * Resolve edit-form metadata using the existing non-counting list API. The
 * resource-ID detail endpoint intentionally records an access and must not be
 * used just to populate edit fields.
 */
export async function findResourceForEditing(id: number): Promise<Resource | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const firstPage = await api.listResources({ page: 0, size: 100, sort: 'id', direction: 'asc' });
  if (firstPage.totalPages === 0 || firstPage.items.length === 0) return null;

  let low = 0;
  let high = firstPage.totalPages - 1;
  while (low <= high) {
    const pageIndex = Math.floor((low + high) / 2);
    const result = pageIndex === 0
      ? firstPage
      : await api.listResources({ page: pageIndex, size: 100, sort: 'id', direction: 'asc' });
    const first = result.items[0];
    const last = result.items[result.items.length - 1];
    if (!first || !last) return null;
    if (id < first.id) {
      high = pageIndex - 1;
      continue;
    }
    if (id > last.id) {
      low = pageIndex + 1;
      continue;
    }
    return result.items.find((resource) => resource.id === id) ?? null;
  }
  return null;
}
