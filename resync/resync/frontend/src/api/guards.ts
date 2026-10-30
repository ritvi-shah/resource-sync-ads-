import type {
  AnalyticsSummary,
  AttachmentMetadata,
  AttachmentPolicy,
  ApiErrorPayload,
  BenchmarkReport,
  BenchmarkRow,
  PopularResource,
  RecentResource,
  Resource,
  ResourceLookup,
  ResourcePage,
  SearchMetrics,
  TreeMetrics,
  TreeNode,
  TreeSnapshot,
} from './types';

export type ResponseGuard<T> = (value: unknown) => value is T;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isSearchMetrics(value: unknown): value is SearchMetrics {
  if (!isObject(value)) return false;
  return isInteger(value.resourceId)
    && typeof value.found === 'boolean'
    && isInteger(value.comparisons)
    && isInteger(value.searchDepth)
    && isInteger(value.rotations)
    && isNullableInteger(value.rootAfterSearch)
    && isString(value.searchedAt);
}

export function isResource(value: unknown): value is Resource {
  if (!isObject(value)) return false;
  return isInteger(value.id)
    && isString(value.title)
    && isNullableString(value.description)
    && isString(value.category)
    && isString(value.resourceType)
    && isNullableString(value.subject)
    && isNullableString(value.academicTerm)
    && isNullableString(value.resourceUrl)
    && isNullableString(value.resourceReference)
    && isStringArray(value.tags)
    && isString(value.createdAt)
    && isString(value.updatedAt)
    && typeof value.sample === 'boolean'
    && isInteger(value.accessCount)
    && isNullableString(value.lastAccessed)
    && (value.attachmentCount === undefined || (isInteger(value.attachmentCount) && value.attachmentCount >= 0));
}

export function isResourcePage(value: unknown): value is ResourcePage {
  return isObject(value)
    && Array.isArray(value.items)
    && value.items.every(isResource)
    && isInteger(value.page)
    && isInteger(value.size)
    && isInteger(value.totalElements)
    && isInteger(value.totalPages);
}

export function isResourceLookup(value: unknown): value is ResourceLookup {
  return isObject(value) && isResource(value.resource) && isSearchMetrics(value.search);
}

export function isPopularResource(value: unknown): value is PopularResource {
  return isObject(value) && isInteger(value.rank) && isResource(value.resource);
}

export function isPopularResourceArray(value: unknown): value is PopularResource[] {
  return Array.isArray(value) && value.every(isPopularResource);
}

export function isRecentResource(value: unknown): value is RecentResource {
  return isObject(value) && isResource(value.resource) && isString(value.accessedAt);
}

export function isRecentResourceArray(value: unknown): value is RecentResource[] {
  return Array.isArray(value) && value.every(isRecentResource);
}

export function isTreeNode(value: unknown): value is TreeNode {
  return isObject(value)
    && isInteger(value.id)
    && isNullableInteger(value.parentId)
    && isNullableInteger(value.leftId)
    && isNullableInteger(value.rightId)
    && isInteger(value.depth);
}

export function isTreeSnapshot(value: unknown): value is TreeSnapshot {
  return isObject(value)
    && isInteger(value.size)
    && isInteger(value.height)
    && isNullableInteger(value.rootId)
    && isNullableInteger(value.lastAccessedResourceId)
    && (value.latestSearch === null || isSearchMetrics(value.latestSearch))
    && Array.isArray(value.nodes)
    && value.nodes.every(isTreeNode);
}

export function isTreeMetrics(value: unknown): value is TreeMetrics {
  return isObject(value)
    && isNullableInteger(value.rootId)
    && isInteger(value.size)
    && isInteger(value.height)
    && (value.latestSearch === null || isSearchMetrics(value.latestSearch));
}

export function isAnalyticsSummary(value: unknown): value is AnalyticsSummary {
  return isObject(value)
    && isInteger(value.resourceCount)
    && isInteger(value.categoryCount)
    && isInteger(value.totalAccesses)
    && isInteger(value.treeSize)
    && isInteger(value.treeHeight)
    && Array.isArray(value.popularResources)
    && value.popularResources.every(isPopularResource)
    && Array.isArray(value.recentResources)
    && value.recentResources.every(isRecentResource);
}

const benchmarkWorkloads = new Set([
  'Random searches',
  'Repeated hot-key searches',
  'Mixed campus access',
  'Zipf-like popularity',
]);
const benchmarkTrees = new Set(['Ordinary BST', 'AVL Tree', 'Splay Tree']);

function isBenchmarkRow(value: unknown): value is BenchmarkRow {
  if (!isObject(value)) return false;
  return isString(value.workload)
    && benchmarkWorkloads.has(value.workload)
    && isString(value.tree)
    && benchmarkTrees.has(value.tree)
    && isInteger(value.resourceCount)
    && isInteger(value.searchCount)
    && isInteger(value.heightAfterMetrics)
    && isFiniteNumber(value.avgComparisons)
    && isFiniteNumber(value.avgDepth)
    && isFiniteNumber(value.avgRotationsPerSearch)
    && isFiniteNumber(value.medianSearchTimeMs);
}

export function isBenchmarkReport(value: unknown): value is BenchmarkReport {
  return isObject(value)
    && typeof value.available === 'boolean'
    && isString(value.reportName)
    && isString(value.message)
    && Array.isArray(value.rows)
    && value.rows.every(isBenchmarkRow);
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!isObject(value) || !isObject(value.details)) return false;
  const detailsAreStrings = Object.values(value.details).every(isString);
  return isString(value.code)
    && isString(value.message)
    && detailsAreStrings
    && isString(value.timestamp)
    && (value.searchMetrics === null || isSearchMetrics(value.searchMetrics));
}

export function isHealthResponse(
  value: unknown,
): value is { status: string; service: string; phase: number; checkedAt: string } {
  return isObject(value)
    && isString(value.status)
    && isString(value.service)
    && isInteger(value.phase)
    && isString(value.checkedAt);
}

export function isVoidResponse(value: unknown): value is void {
  return value === null || value === undefined;
}

export function isAttachmentMetadata(value: unknown): value is AttachmentMetadata {
  return isObject(value)
    && isInteger(value.id)
    && isInteger(value.resourceId)
    && isString(value.originalFilename)
    && value.originalFilename.trim().length > 0
    && !value.originalFilename.includes('/')
    && !value.originalFilename.includes('\\')
    && isInteger(value.sizeBytes)
    && value.sizeBytes > 0
    && value.contentType === 'application/pdf'
    && isString(value.uploadedAt);
}

export function isAttachmentMetadataArray(value: unknown): value is AttachmentMetadata[] {
  return Array.isArray(value) && value.every(isAttachmentMetadata);
}

export function isAttachmentPolicy(value: unknown): value is AttachmentPolicy {
  return isObject(value)
    && isInteger(value.maxFileSizeBytes)
    && value.maxFileSizeBytes > 0
    && value.contentType === 'application/pdf'
    && isInteger(value.maxFilesPerRequest)
    && value.maxFilesPerRequest === 1;
}
