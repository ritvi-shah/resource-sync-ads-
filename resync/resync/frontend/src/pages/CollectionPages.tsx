import { Link } from 'react-router-dom';
import { ArrowRight, Flame, Clock3 } from 'lucide-react';
import { usePopularResources, useRecentResources } from '../api/queries';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from '../components/PageStates';
import { resourceMetadataSummary } from '../api/display';

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : dateTime.format(date);
}

export function PopularResourcesPage() {
  const popular = usePopularResources(100);
  return (
    <div className="page-stack">
      <PageHeading title="Popular Resources" description="Resources ranked by the successful access events recorded by the Java service." action={<Link className="button button-secondary" to="/resources"><ArrowRight size={15} /> Browse library</Link>} />
      <div className="notice-card notice-neutral"><Flame size={16} aria-hidden="true" /><span>Access counts represent successful resource opens—not distinct people. Equal counts are close in rank and should not be read as meaningful differences.</span></div>
      {popular.isPending ? <LoadingPanel label="Loading recorded popularity…" /> : null}
      {popular.isError ? <ErrorPanel error={popular.error} onRetry={() => void popular.refetch()} /> : null}
      {popular.data && popular.data.length === 0 ? <EmptyPanel title="No recorded popularity yet" description="A resource appears here after a successful open." action={<Link className="button button-primary" to="/resources">Find a resource</Link>} /> : null}
      {popular.data?.length ? (
        <section className="panel table-panel">
          <div className="panel-head"><div><h2 className="panel-title">Recorded access ranking</h2><p className="panel-subtitle">Sorted using the backend’s event count and documented tie-break rules.</p></div><span className="table-count">{popular.data.length} records</span></div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Rank</th><th scope="col">Resource</th><th scope="col">Category</th><th scope="col">Recorded accesses</th><th scope="col">Last opened</th></tr></thead><tbody>
            {popular.data.map(({ rank, resource }) => <tr key={resource.id}><td><span className="rank-number">{String(rank).padStart(2, '0')}</span></td><td><Link className="resource-title-link" to={`/resources/${resource.id}`}>{resource.title}</Link><small className="resource-meta-summary">{resourceMetadataSummary(resource)}</small></td><td>{resource.category}</td><td className="numeric-cell">{resource.accessCount.toLocaleString('en')}</td><td>{formatDate(resource.lastAccessed)}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}
    </div>
  );
}

export function RecentResourcesPage() {
  const recent = useRecentResources(20);
  return (
    <div className="page-stack">
      <PageHeading title="Recent Resources" description="The latest distinct resources in the backend’s bounded access history." action={<Link className="button button-secondary" to="/resources"><ArrowRight size={15} /> Browse library</Link>} />
      <div className="notice-card notice-neutral"><Clock3 size={16} aria-hidden="true" /><span>This list contains up to 20 distinct resource IDs. Reopening one moves it to the front; it does not add another row for every event.</span></div>
      {recent.isPending ? <LoadingPanel label="Loading recent resource activity…" /> : null}
      {recent.isError ? <ErrorPanel error={recent.error} onRetry={() => void recent.refetch()} /> : null}
      {recent.data && recent.data.length === 0 ? <EmptyPanel title="No recent resources" description="Open a resource by selecting its name to add it to the real access history." action={<Link className="button button-primary" to="/resources">Search the library</Link>} /> : null}
      {recent.data?.length ? (
        <section className="panel table-panel">
          <div className="panel-head"><div><h2 className="panel-title">Recently opened</h2><p className="panel-subtitle">Timestamps are actual persisted access-event times.</p></div><span className="table-count">{recent.data.length} distinct resources</span></div>
          <div className="recent-list">
            {recent.data.map(({ resource, accessedAt }, index) => (
              <article className="recent-row" key={`${resource.id}-${accessedAt}`}>
                <span className="recent-order">{String(index + 1).padStart(2, '0')}</span>
                <div className="recent-row-main"><Link className="resource-title-link" to={`/resources/${resource.id}`}>{resource.title}</Link><span className="resource-meta-summary">{resourceMetadataSummary(resource)}</span></div>
                <time className="recent-time" dateTime={accessedAt}>{formatDate(accessedAt)}</time>
                <Link className="icon-button" to={`/resources/${resource.id}`} aria-label={`Open ${resource.title}`}><ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
