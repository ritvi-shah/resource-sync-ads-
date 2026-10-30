export interface Resource {
  id: number;
  title: string;
  description: string | null;
  category: string;
  resourceType: string;
  subject: string | null;
  academicTerm: string | null;
  resourceUrl: string | null;
  resourceReference: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sample: boolean;
  accessCount: number;
  lastAccessed: string | null;
  attachmentCount?: number;
}

export interface ResourceWriteRequest {
  id: number;
  title: string;
  description?: string;
  category: string;
  resourceType: string;
  subject?: string;
  academicTerm?: string;
  resourceUrl?: string;
  resourceReference?: string;
  tags?: string[];
}

export interface ResourcePage {
  items: Resource[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface SearchMetrics {
  resourceId: number;
  found: boolean;
  comparisons: number;
  searchDepth: number;
  rotations: number;
  rootAfterSearch: number | null;
  searchedAt: string;
}

export interface ResourceLookup {
  resource: Resource;
  search: SearchMetrics;
}

export interface PopularResource {
  rank: number;
  resource: Resource;
}

export interface RecentResource {
  resource: Resource;
  accessedAt: string;
}

export interface TreeNode {
  id: number;
  parentId: number | null;
  leftId: number | null;
  rightId: number | null;
  depth: number;
}

export interface TreeSnapshot {
  size: number;
  height: number;
  rootId: number | null;
  lastAccessedResourceId: number | null;
  latestSearch: SearchMetrics | null;
  nodes: TreeNode[];
}

export interface TreeMetrics {
  rootId: number | null;
  size: number;
  height: number;
  latestSearch: SearchMetrics | null;
}

export interface AnalyticsSummary {
  resourceCount: number;
  categoryCount: number;
  totalAccesses: number;
  treeSize: number;
  treeHeight: number;
  popularResources: PopularResource[];
  recentResources: RecentResource[];
}

export type BenchmarkTreeName = 'Ordinary BST' | 'AVL Tree' | 'Splay Tree';
export type BenchmarkWorkload =
  | 'Random searches'
  | 'Repeated hot-key searches'
  | 'Mixed campus access'
  | 'Zipf-like popularity';

export interface BenchmarkRow {
  workload: BenchmarkWorkload;
  tree: BenchmarkTreeName;
  resourceCount: number;
  searchCount: number;
  heightAfterMetrics: number;
  avgComparisons: number;
  avgDepth: number;
  avgRotationsPerSearch: number;
  medianSearchTimeMs: number;
}

export interface BenchmarkReport {
  available: boolean;
  reportName: string;
  message: string;
  rows: BenchmarkRow[];
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details: Record<string, string>;
  timestamp: string;
  searchMetrics: SearchMetrics | null;
}

export interface ResourceFilters {
  q?: string;
  category?: string;
  type?: string;
  page?: number;
  size?: number;
  sort?: 'id' | 'title' | 'createdAt' | 'updatedAt';
  direction?: 'asc' | 'desc';
}

export interface AttachmentMetadata {
  id: number;
  resourceId: number;
  originalFilename: string;
  sizeBytes: number;
  contentType: 'application/pdf';
  uploadedAt: string;
}

export interface AttachmentPolicy {
  maxFileSizeBytes: number;
  contentType: 'application/pdf';
  maxFilesPerRequest: number;
}
