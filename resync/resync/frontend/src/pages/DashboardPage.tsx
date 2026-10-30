import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, GitBranch, LibraryBig } from 'lucide-react';
import { useDashboardSummary } from '../api/queries';
import type { Resource } from '../api/types';
import ResourceSearch from '../components/ResourceSearch';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from '../components/PageStates';

const number = new Intl.NumberFormat('en');
const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
function formatDate(value: string | null | undefined) {
  if (!value) return 'No recorded access';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Time unavailable' : dateTime.format(date);
}

function ResourceShortcut({ resource, meta }: { resource: Resource; meta: string }) {
  return (
    <Link className="resource-shortcut" to={`/resources/${resource.id}`}>
      <span className="shortcut-copy"><strong>{resource.title}</strong><small>{meta}</small></span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const summary = useDashboardSummary();

  return (
    <div className="page-stack">
      <PageHeading title="Dashboard" description="A clear view of the resources your campus keeps close." action={<Link className="button button-primary" to="/resources"><LibraryBig size={16} /> Browse library</Link>} />

      <section className="panel search-panel" aria-label="Search campus resources">
        <div className="search-panel-copy">
          <p className="eyebrow">RESOURCE DISCOVERY</p>
          <h2>Find a resource by title or topic.</h2>
          <p>Search the real catalogue by title, subject, description or tags.</p>
        </div>
        <ResourceSearch onSelect={(resource) => navigate(`/resources/${resource.id}`)} />
      </section>

      {summary.isPending ? <LoadingPanel label="Loading live catalogue summary…" /> : null}
      {summary.isError ? <ErrorPanel error={summary.error} onRetry={() => void summary.refetch()} /> : null}
      {summary.data ? (
        <>
          <section className="summary-strip" aria-label="Current catalogue summary">
            <article className="summary-metric">
              <span className="metric-label">Resources in catalogue</span>
              <strong className="metric-value">{number.format(summary.data.resourceCount)}</strong>
              <span className="metric-foot">Records currently available</span>
            </article>
            <article className="summary-metric">
              <span className="metric-label">Recorded accesses</span>
              <strong className="metric-value">{number.format(summary.data.totalAccesses)}</strong>
              <span className="metric-foot">Successful resource opens</span>
            </article>
            <article className="summary-metric">
              <span className="metric-label">Categories</span>
              <strong className="metric-value">{number.format(summary.data.categoryCount)}</strong>
              <span className="metric-foot">Distinct catalogue groups</span>
            </article>
            <article className="summary-metric summary-tree-metric">
              <span className="metric-label"><GitBranch size={14} /> Java Splay Tree</span>
              <strong className="metric-value">{number.format(summary.data.treeSize)} <small>nodes</small></strong>
              <span className="metric-foot">Height {summary.data.treeHeight} · live structure</span>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="panel dashboard-panel">
              <div className="panel-head">
                <div><p className="eyebrow">MOST ACCESSED</p><h2 className="panel-title">Popular resources</h2><p className="panel-subtitle">Ranked by recorded access events.</p></div>
                <Link to="/popular" className="subtle-link">View all <ArrowRight size={15} /></Link>
              </div>
              {summary.data.popularResources.length ? (
                <div className="shortcut-list">
                  {summary.data.popularResources.slice(0, 5).map((entry) => (
                    <div className="ranked-shortcut" key={entry.resource.id}>
                      <span className="rank-number">{String(entry.rank).padStart(2, '0')}</span>
                      <ResourceShortcut resource={entry.resource} meta={`${number.format(entry.resource.accessCount)} recorded ${entry.resource.accessCount === 1 ? 'access' : 'accesses'} · ${entry.resource.category}`} />
                    </div>
                  ))}
                </div>
              ) : <EmptyPanel title="No popular resources yet" description="A resource appears here after it has been opened successfully." />}
            </article>

            <article className="panel dashboard-panel">
              <div className="panel-head">
                <div><p className="eyebrow">RECENTLY OPENED</p><h2 className="panel-title">Recent resources</h2><p className="panel-subtitle">Distinct resources from the bounded recent history.</p></div>
                <Link to="/recent" className="subtle-link">View all <ArrowRight size={15} /></Link>
              </div>
              {summary.data.recentResources.length ? (
                <div className="shortcut-list">
                  {summary.data.recentResources.slice(0, 5).map((entry, index) => (
                    <div className="ranked-shortcut" key={`${entry.resource.id}-${entry.accessedAt}`}>
                      <span className="rank-number rank-muted">{String(index + 1).padStart(2, '0')}</span>
                      <ResourceShortcut resource={entry.resource} meta={`${entry.resource.category} · ${formatDate(entry.accessedAt)}`} />
                    </div>
                  ))}
                </div>
              ) : <EmptyPanel title="No recent resources" description="Recently opened resources will appear here after a successful lookup." />}
            </article>
          </section>

          <div className="dashboard-footnote"><GitBranch size={15} aria-hidden="true" /><span>Catalogue search matches metadata; the Splay Tree is used only when a resource is opened by its internal identifier.</span><Link to="/dsa">Explore the tree <ArrowRight size={14} /></Link></div>
        </>
      ) : null}
    </div>
  );
}
