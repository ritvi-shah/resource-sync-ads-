import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Pencil, Trash2 } from 'lucide-react';
import { useDeleteResource, useOpenResource, useResourceAttachments } from '../api/queries';
import { ApiClientError } from '../api/client';
import type { SearchMetrics } from '../api/types';
import type { PdfUploadEntry } from '../api/attachmentUploads';
import { formatTimestamp, safeHttpUrl } from '../api/display';
import { ErrorPanel, LoadingPanel, PageHeading } from '../components/PageStates';
import DocumentAttachments from '../components/DocumentAttachments';

export default function ResourceDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const location = useLocation();
  const navigate = useNavigate();
  const access = useOpenResource();
  const deletion = useDeleteResource();
  const attachmentList = useResourceAttachments(id, validId && access.data?.resource.id === id);
  const routeState = location.state as { notice?: string; retryUploads?: PdfUploadEntry[] } | null;

  useEffect(() => {
    if (validId) access.mutate(id);
    // Access is an intentional event: issue it once per route navigation, not as a refetchable query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId]);

  if (!validId) {
    return <div className="page-stack"><PageHeading title="Resource details" description="A resource record could not be opened." /><div className="notice-card notice-error" role="alert">The resource address is invalid. Return to the library and select a resource by name.</div><Link className="button button-secondary" to="/resources"><ArrowLeft size={16} /> Back to library</Link></div>;
  }
  if (access.isPending) {
    return <div className="page-stack"><PageHeading title="Resource details" description="Opening the selected catalogue record." /><LoadingPanel label="Looking up the resource in the Java Splay Tree…" /></div>;
  }
  if (access.isError) {
    const detailsError = access.error instanceof ApiClientError ? access.error : undefined;
    return (
      <div className="page-stack">
        <PageHeading title="Resource details" description="The selected catalogue record could not be opened." />
        <ErrorPanel error={access.error} onRetry={() => { access.reset(); access.mutate(id); }} />
        {detailsError?.payload?.searchMetrics ? <SearchMetricsCard metrics={detailsError.payload.searchMetrics} /> : null}
        <Link className="button button-secondary" to="/resources"><ArrowLeft size={16} /> Back to library</Link>
      </div>
    );
  }
  const lookup = access.data;
  if (!lookup || lookup.resource.id !== id) {
    return <div className="page-stack"><PageHeading title="Resource details" description="Opening the selected catalogue record." /><LoadingPanel label="Looking up the resource in the Java Splay Tree…" /></div>;
  }

  const resource = lookup.resource;
  const metrics = lookup.search;
  const url = safeHttpUrl(resource.resourceUrl);

  async function removeResource() {
    if (!window.confirm(`Delete “${resource.title}” from the catalogue? This also removes its recorded access history.`)) return;
    try {
      await deletion.mutateAsync(id);
      navigate('/resources', { replace: true, state: { notice: 'Resource deleted from the catalogue.' } });
    } catch {
      // The mutation error is rendered in this page; no success navigation occurred.
    }
  }

  return (
    <div className="page-stack">
      <PageHeading title="Resource details" description="Catalogue metadata and the actual Java lookup metrics for this open." action={<Link className="button button-secondary" to="/resources"><ArrowLeft size={15} /> Library</Link>} />
      {routeState?.notice ? <div className="notice-card notice-success" role="status">{routeState.notice}</div> : null}
      {deletion.isError ? <div className="notice-card notice-error" role="alert">{deletion.error instanceof ApiClientError ? deletion.error.message : 'The resource could not be deleted. Try again.'}</div> : null}
      <article className="panel resource-detail-panel">
        <div className="detail-heading-row">
          <div className="detail-title-group"><div className="resource-badges"><span className="category-mark">{resource.category}</span>{resource.sample ? <span className="sample-mark">Demonstration sample</span> : null}</div><h2>{resource.title}</h2><p>{resource.description || 'No description has been added.'}</p></div>
          <div className="detail-actions"><Link className="button button-secondary" to={`/resources/${id}/edit`} state={{ resource }}><Pencil size={15} /> Edit</Link><button className="button button-danger" type="button" onClick={() => void removeResource()} disabled={deletion.isPending}><Trash2 size={15} /> {deletion.isPending ? 'Deleting…' : 'Delete'}</button></div>
        </div>
        <dl className="detail-grid">
          <div><dt>Category</dt><dd>{resource.category}</dd></div>
          <div><dt>Resource type</dt><dd>{resource.resourceType}</dd></div>
          <div><dt>Subject</dt><dd>{resource.subject || 'Not specified'}</dd></div>
          <div><dt>Academic term</dt><dd>{resource.academicTerm || 'Not specified'}</dd></div>
          <div><dt>Created</dt><dd>{formatTimestamp(resource.createdAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatTimestamp(resource.updatedAt)}</dd></div>
          <div><dt>Recorded accesses</dt><dd>{resource.accessCount.toLocaleString('en')}</dd></div>
          <div><dt>Last opened</dt><dd>{formatTimestamp(resource.lastAccessed)}</dd></div>
          <div><dt>PDF attachments</dt><dd>{attachmentList.data?.length ?? resource.attachmentCount ?? 0}</dd></div>
        </dl>
        <div className="detail-resource-link">
          {url ? <a className="button button-primary" href={url} target="_blank" rel="noopener noreferrer">Open linked resource <ArrowUpRight size={16} /></a> : <p className="inline-note">No external URL is linked. Stored PDFs appear in the attachment manager below.</p>}
        </div>
        {resource.resourceReference ? <div className="reference-note"><strong>Reference metadata</strong><code>{resource.resourceReference}</code><span>Stored as opaque metadata; it is not opened as a local file.</span></div> : null}
        {resource.tags.length ? <div className="tag-row" aria-label="Resource tags">{resource.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}</div> : null}
      </article>

      <SearchMetricsCard metrics={metrics} />
      <DocumentAttachments key={id} resourceId={id} retryUploads={routeState?.retryUploads ?? []} />
    </div>
  );
}

function SearchMetricsCard({ metrics }: { metrics: SearchMetrics | null | undefined }) {
  if (!metrics) return null;
  return (
    <section className="panel search-metrics-panel" aria-label="Actual Splay Tree lookup metrics">
      <div className="panel-head"><div><p className="eyebrow">THIS LOOKUP</p><h2 className="panel-title">Splay Tree search metrics</h2><p className="panel-subtitle">Measured by the Java backend for this resource-ID lookup.</p></div><span className={`search-result-state ${metrics.found ? 'search-found' : 'search-missing'}`}>{metrics.found ? 'Found' : 'Not found'}</span></div>
      <div className="metric-strip metric-strip-compact"><div className="metric-cell"><span>Comparisons</span><strong>{metrics.comparisons}</strong></div><div className="metric-cell"><span>Search depth</span><strong>{metrics.searchDepth}</strong></div><div className="metric-cell"><span>Rotations</span><strong>{metrics.rotations}</strong></div><div className="metric-cell"><span>Root after lookup</span><strong>{metrics.rootAfterSearch ?? '—'}</strong></div></div>
      <p className="metric-timestamp">Lookup recorded {formatTimestamp(metrics.searchedAt)} · a measured lookup is not a guarantee of faster future searches.</p>
    </section>
  );
}
