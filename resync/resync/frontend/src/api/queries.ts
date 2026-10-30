import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type UploadProgressHandler } from './client';
import type { ResourceFilters, ResourceWriteRequest } from './types';

export const queryKeys = {
  summary: ['analytics', 'summary'] as const,
  resources: ['resources'] as const,
  search: ['resource-search'] as const,
  popular: ['resources', 'popular'] as const,
  recent: ['resources', 'recent'] as const,
  tree: ['dsa', 'tree'] as const,
  treeMetrics: ['dsa', 'metrics'] as const,
  benchmarks: ['analytics', 'benchmarks'] as const,
  attachmentPolicy: ['attachments', 'policy'] as const,
  attachments: ['resource-attachments'] as const,
};

export function useDashboardSummary() {
  return useQuery({ queryKey: queryKeys.summary, queryFn: api.getSummary, staleTime: 15_000 });
}

export function useResourcePage(filters: ResourceFilters) {
  return useQuery({ queryKey: [...queryKeys.resources, filters], queryFn: () => api.listResources(filters), staleTime: 10_000 });
}

export function useResourceSearch(query: string, category = '', type = '', enabled = true) {
  const normalized = query.trim();
  return useQuery({
    queryKey: [...queryKeys.search, normalized, category, type],
    queryFn: () => api.searchResources(normalized, { category: category || undefined, type: type || undefined }),
    enabled: enabled && normalized.length > 0,
    staleTime: 10_000,
  });
}

export function usePopularResources(limit = 10) {
  return useQuery({ queryKey: [...queryKeys.popular, limit], queryFn: () => api.getPopular(limit), staleTime: 15_000 });
}

export function useRecentResources(limit = 20) {
  return useQuery({ queryKey: [...queryKeys.recent, limit], queryFn: () => api.getRecent(limit), staleTime: 10_000 });
}

export function useTreeSnapshot() {
  return useQuery({ queryKey: queryKeys.tree, queryFn: api.getTree, staleTime: 5_000 });
}

export function useTreeMetrics() {
  return useQuery({ queryKey: queryKeys.treeMetrics, queryFn: api.getTreeMetrics, staleTime: 5_000 });
}

export function useBenchmarkReport() {
  return useQuery({ queryKey: queryKeys.benchmarks, queryFn: api.getBenchmarks, staleTime: 60_000 });
}

export function useAttachmentPolicy() {
  return useQuery({ queryKey: queryKeys.attachmentPolicy, queryFn: api.getAttachmentPolicy, staleTime: 60_000 });
}

export function useResourceAttachments(resourceId: number, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.attachments, resourceId],
    queryFn: () => api.getAttachments(resourceId),
    enabled: enabled && Number.isSafeInteger(resourceId) && resourceId > 0,
    staleTime: 5_000,
  });
}

function invalidateAfterChange(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.summary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.resources }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search }),
    queryClient.invalidateQueries({ queryKey: queryKeys.popular }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recent }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tree }),
    queryClient.invalidateQueries({ queryKey: queryKeys.treeMetrics }),
  ]);
}

function invalidateAfterFailedLookup(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.summary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tree }),
    queryClient.invalidateQueries({ queryKey: queryKeys.treeMetrics }),
  ]);
}

export function useOpenResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.getResource,
    onSuccess: () => invalidateAfterChange(queryClient),
    onError: () => invalidateAfterFailedLookup(queryClient),
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ResourceWriteRequest) => api.createResource(request),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useUpdateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resource }: { id: number; resource: ResourceWriteRequest }) => api.updateResource(id, resource),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteResource,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, file, idempotencyKey, onProgress }: { resourceId: number; file: File; idempotencyKey: string; onProgress?: UploadProgressHandler }) =>
      api.uploadAttachment(resourceId, file, idempotencyKey, onProgress),
    onSuccess: (_, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKeys.attachments, variables.resourceId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.resources }),
      ]).catch(() => undefined);
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, attachmentId }: { resourceId: number; attachmentId: number }) =>
      api.deleteAttachment(resourceId, attachmentId),
    onSuccess: (_, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKeys.attachments, variables.resourceId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.resources }),
      ]).catch(() => undefined);
    },
  });
}
