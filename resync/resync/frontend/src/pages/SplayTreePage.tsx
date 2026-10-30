import { useMemo, useState, type FormEvent } from 'react';
import ResourceSearch from '../components/ResourceSearch';
import { useOpenResource, useTreeMetrics, useTreeSnapshot } from '../api/queries';
import type { Resource, SearchMetrics, TreeNode } from '../api/types';

type SearchResult = {
  resource: Resource;
  search: SearchMetrics;
};

type PositionedNode = {
  node: TreeNode;
  x: number;
  y: number;
};

function arrangeNodes(nodes: TreeNode[], rootId: number | null): PositionedNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<number>();
  const ordered: TreeNode[] = [];

  const visit = (id: number | null) => {
    if (id === null || visited.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    visited.add(id);
    visit(node.leftId);
    ordered.push(node);
    visit(node.rightId);
  };

  visit(rootId);
  // Include only nodes returned by the server; any unlinked records stay visibly unlinked.
  nodes.filter((node) => !visited.has(node.id)).sort((a, b) => a.depth - b.depth || a.id - b.id).forEach((node) => ordered.push(node));

  const horizontalGap = 142;
  const verticalGap = 112;
  return ordered.map((node, index) => ({
    node,
    x: 72 + index * horizontalGap,
    y: 54 + Math.max(0, node.depth) * verticalGap,
  }));
}

function formatError(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    const status = error.status;
    if (status === 404) return 'The requested resource was not found (HTTP 404).';
    if (error instanceof Error) return `${error.message} (HTTP ${status}).`;
  }
  return error instanceof Error ? error.message : 'The request could not be completed. Please try again.';
}

function errorSearchMetrics(error: unknown): SearchMetrics | null {
  if (!error || typeof error !== 'object' || !('payload' in error)) return null;
  const payload = error.payload;
  if (!payload || typeof payload !== 'object' || !('searchMetrics' in payload)) return null;
  const metrics = payload.searchMetrics;
  return metrics && typeof metrics === 'object' ? (metrics as SearchMetrics) : null;
}

function SearchMetricsSummary({ metrics }: { metrics: SearchMetrics }) {
  return (
    <p className="panel-subtitle" aria-label="Search metrics">
      Comparisons: {metrics.comparisons} · depth: {metrics.searchDepth} · rotations: {metrics.rotations} · root after search: {metrics.rootAfterSearch ?? '—'}
    </p>
  );
}

export default function SplayTreePage() {
  const snapshotQuery = useTreeSnapshot();
  const metricsQuery = useTreeMetrics();
  const openResource = useOpenResource();
  const [manualId, setManualId] = useState('');
  const [manualError, setManualError] = useState('');
  const [searchError, setSearchError] = useState<{ message: string; metrics: SearchMetrics | null } | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const snapshot = snapshotQuery.data;
  const metrics = metricsQuery.data;
  const nodes = snapshot?.nodes ?? [];
  const rootId = snapshot?.rootId ?? metrics?.rootId ?? null;
  const positionedNodes = useMemo(() => arrangeNodes(nodes, rootId), [nodes, rootId]);
  const positionById = useMemo(() => new Map(positionedNodes.map((item) => [item.node.id, item])), [positionedNodes]);
  const treeWidth = Math.max(560, 144 + Math.max(0, positionedNodes.length - 1) * 142);
  const maxDepth = positionedNodes.reduce((max, item) => Math.max(max, item.node.depth), 0);
  const treeHeight = Math.max(160, 112 + Math.max(0, maxDepth) * 112);
  const latestSearch = metrics?.latestSearch ?? snapshot?.latestSearch ?? null;
  const loading = snapshotQuery.isLoading || metricsQuery.isLoading;
  const queryError = snapshotQuery.error || metricsQuery.error;

  const accessResource = async (id: number) => {
    setSearchError(null);
    setResult(null);
    try {
      const response = await openResource.mutateAsync(id);
      setResult(response);
    } catch (error) {
      setSearchError({ message: formatError(error), metrics: errorSearchMetrics(error) });
    }
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = Number(manualId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setManualError('Enter a positive whole-number resource ID.');
      return;
    }
    setManualError('');
    void accessResource(id);
  };

  const retryLoading = () => {
    void Promise.all([snapshotQuery.refetch(), metricsQuery.refetch()]);
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Splay Tree</h1>
        <p className="page-description">
          Search campus resources and inspect the tree state returned by the server. Each successful resource access is recorded by the API.
        </p>
      </header>

      <section className="panel" aria-labelledby="resource-search-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="resource-search-title">Find a resource</h2>
            <p className="panel-subtitle">Search by name, then select a result to access it.</p>
          </div>
        </div>
        <ResourceSearch
          compact
          placeholder="Search resources by name"
          onSelect={(resource: Resource) => void accessResource(resource.id)}
        />
        {openResource.isPending && <p className="state-panel" role="status">Recording resource access…</p>}
        {searchError && (
          <div className="notice-card" role="alert">
            <p>{searchError.message}</p>
            {searchError.metrics ? (
              <SearchMetricsSummary metrics={searchError.metrics} />
            ) : (
              <p className="panel-subtitle">The server did not provide search metrics for this error.</p>
            )}
          </div>
        )}
        {result && (
          <div className="notice-card" role="status" aria-live="polite">
            <h3 className="panel-title">Access recorded: {result.resource.title}</h3>
            <p className="panel-subtitle">Resource ID {result.resource.id}</p>
            <SearchMetricsSummary metrics={result.search} />
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="tree-panel-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="tree-panel-title">Live tree state</h2>
            <p className="panel-subtitle">Nodes, links, depth, root, and latest access come from the API snapshot.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={retryLoading} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh tree'}
          </button>
        </div>

        {loading && !snapshot && (
          <div className="state-panel" role="status" aria-live="polite">Loading the current Splay Tree…</div>
        )}
        {queryError && (
          <div className="notice-card" role="alert">
            <p>Could not load the latest tree data. {formatError(queryError)}</p>
            <button className="button button-secondary" type="button" onClick={retryLoading}>Retry</button>
          </div>
        )}
        {!loading && !queryError && snapshot && snapshot.nodes.length === 0 && (
          <div className="state-panel">The Splay Tree is empty. Search for and access a resource to see it represented here.</div>
        )}

        {snapshot && snapshot.nodes.length > 0 && (
          <>
            <div className="metric-strip" aria-label="Tree metrics">
              <div className="metric-cell"><span>Nodes</span><strong>{metrics?.size ?? snapshot.size}</strong></div>
              <div className="metric-cell"><span>Height</span><strong>{metrics?.height ?? snapshot.height}</strong></div>
              <div className="metric-cell"><span>Root ID</span><strong>{rootId ?? '—'}</strong></div>
              <div className="metric-cell">
                <span>Latest search</span>
                <strong>{latestSearch ? `${latestSearch.comparisons} comparisons` : '—'}</strong>
              </div>
              <div className="metric-cell">
                <span>Latest depth / rotations</span>
                <strong>{latestSearch ? `${latestSearch.searchDepth} / ${latestSearch.rotations}` : '—'}</strong>
              </div>
            </div>
            <div className="tree-canvas" role="region" aria-label="Scrollable Splay Tree diagram" tabIndex={0} style={{ overflow: 'auto', maxHeight: '70vh' }}>
              <svg
                className="tree-svg"
                width={treeWidth}
                height={treeHeight}
                viewBox={`0 0 ${treeWidth} ${treeHeight}`}
                role="img"
                aria-labelledby="tree-svg-title tree-svg-description"
              >
                <title id="tree-svg-title">Splay Tree with {snapshot.nodes.length} resource nodes</title>
                <desc id="tree-svg-description">
                  The diagram shows server-returned resource IDs and left and right child links. Root ID is {rootId ?? 'not available'}; last accessed resource ID is {snapshot.lastAccessedResourceId ?? 'not available'}.
                </desc>
                {snapshot.nodes.map((node) => {
                  const parent = positionById.get(node.id);
                  if (!parent) return null;
                  return ([node.leftId, node.rightId] as const).map((childId) => {
                    if (childId === null) return null;
                    const child = positionById.get(childId);
                    if (!child) return null;
                    return (
                      <line
                        className="tree-edge"
                        key={`${node.id}-${childId}`}
                        x1={parent.x}
                        y1={parent.y + 22}
                        x2={child.x}
                        y2={child.y - 22}
                        aria-hidden="true"
                      />
                    );
                  });
                })}
                {positionedNodes.map(({ node, x, y }) => {
                  const isRoot = node.id === rootId;
                  const isLast = node.id === snapshot.lastAccessedResourceId;
                  const nodeClass = ['tree-node', isRoot ? 'tree-node-root' : '', isLast ? 'tree-node-last' : ''].filter(Boolean).join(' ');
                  const label = `Resource ${node.id}, depth ${node.depth}${isRoot ? ', root' : ''}${isLast ? ', last accessed' : ''}`;
                  return (
                    <g className={nodeClass} key={node.id} role="img" aria-label={label}>
                      <circle cx={x} cy={y} r={22} />
                      <text x={x} y={y + 4} textAnchor="middle">{node.id}</text>
                      <text x={x} y={y + 40} textAnchor="middle">depth {node.depth}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="panel-subtitle">
              <span className="tree-node-root">Root</span> · <span className="tree-node-last">Last accessed</span>
              {latestSearch && <> · Latest server search: {latestSearch.comparisons} comparisons, depth {latestSearch.searchDepth}, {latestSearch.rotations} rotations</>}
            </p>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="splay-explanation-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="splay-explanation-title">How a Splay Tree behaves</h2>
            <p className="panel-subtitle">
              A Splay Tree moves accessed nodes toward the root, which may help when the same resources are accessed repeatedly. It does not guarantee that every lookup is faster than an AVL Tree; performance depends on the access pattern.
            </p>
          </div>
        </div>
      </section>

      <details className="panel">
        <summary className="panel-title">Optional: DSA Demonstration</summary>
        <p className="panel-subtitle">Enter a resource ID only for this demonstration. It calls the same server access endpoint; no tree operation is simulated in the browser.</p>
        <form onSubmit={handleManualSubmit}>
          <label className="form-control" htmlFor="demo-resource-id">Resource ID
            <input
              id="demo-resource-id"
              name="resourceId"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={manualId}
              onChange={(event) => { setManualId(event.target.value); setManualError(''); }}
              aria-invalid={Boolean(manualError)}
              aria-describedby={manualError ? 'demo-id-error' : undefined}
            />
          </label>
          {manualError && <p className="notice-card" id="demo-id-error" role="alert">{manualError}</p>}
          <button className="button" type="submit" disabled={openResource.isPending}>
            {openResource.isPending ? 'Searching…' : 'Access resource ID'}
          </button>
        </form>
      </details>
    </div>
  );
}
