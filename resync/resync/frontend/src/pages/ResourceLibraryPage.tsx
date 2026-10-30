import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react';
import { useDeleteResource, useResourcePage } from '../api/queries';
import type { Resource, ResourceFilters } from '../api/types';
import { ApiClientError } from '../api/client';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from '../components/PageStates';

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : dateTime.format(date);
}

export default function ResourceLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState({ q: '', category: '', type: '' });
  const [filters, setFilters] = useState<ResourceFilters>({ page: 0, size: 10, sort: 'title', direction: 'asc' });
  const page = useResourcePage(filters);
  const deletion = useDeleteResource();
  const [actionError, setActionError] = useState('');
  const notice = (location.state as { notice?: string } | null)?.notice;

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      q: draft.q.trim() || undefined,
      category: draft.category.trim() || undefined,
      type: draft.type.trim() || undefined,
      page: 0,
    }));
  }

  function clearFilters() {
    setDraft({ q: '', category: '', type: '' });
    setFilters((current) => ({ page: 0, size: current.size, sort: current.sort, direction: current.direction }));
  }

  async function removeResource(resource: Resource) {
    setActionError('');
    if (!window.confirm(`Delete “${resource.title}” from the catalogue? This also removes its recorded access history.`)) return;
    try {
      await deletion.mutateAsync(resource.id);
      setActionError('');
      void page.refetch();
      navigate('/resources', { replace: true, state: { notice: 'Resource deleted from the catalogue.' } });
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : 'The resource could not be deleted. Try again.');
    }
  }

  const results = page.data?.items ?? [];
  const totalPages = page.data?.totalPages ?? 0;
  const currentPage = page.data?.page ?? filters.page ?? 0;
  const hasFilters = Boolean(filters.q || filters.category || filters.type);

  return (
    <div className="page-stack">
      <PageHeading title="Resource Library" description="Browse and maintain the academic material in your live catalogue." action={<Link to="/resources/new" className="button button-primary"><Plus size={16} /> Add resource</Link>} />
      {notice ? <div className="notice-card notice-success" role="status">{notice}</div> : null}
      {actionError ? <div className="notice-card notice-error" role="alert">{actionError}</div> : null}

      <form className="panel filter-panel" onSubmit={applyFilters}>
        <div className="filter-grid">
          <label className="form-field filter-search-field"><span>Search catalogue</span><input className="form-control" value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="Title, subject, description or tag" maxLength={160} /></label>
          <label className="form-field"><span>Category</span><input className="form-control" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Any category" /></label>
          <label className="form-field"><span>Resource type</span><input className="form-control" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} placeholder="Any type" /></label>
          <div className="filter-actions"><button className="button button-primary" type="submit"><RotateCw size={15} /> Apply</button><button className="button button-secondary" type="button" onClick={clearFilters}>Clear</button></div>
        </div>
        <div className="table-controls">
          <span>{page.data ? `${page.data.totalElements.toLocaleString('en')} ${page.data.totalElements === 1 ? 'resource' : 'resources'}` : 'Catalogue records'}</span>
          <div className="table-control-group">
            <label htmlFor="resource-sort">Sort by</label>
            <select id="resource-sort" className="form-control form-control-small" value={filters.sort ?? 'title'} onChange={(event) => setFilters({ ...filters, sort: event.target.value as ResourceFilters['sort'], page: 0 })}>
              <option value="title">Title</option><option value="createdAt">Date added</option><option value="updatedAt">Last updated</option><option value="id">Internal order</option>
            </select>
            <button className="icon-button sort-direction" type="button" aria-label={`Sort ${filters.direction === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setFilters({ ...filters, direction: filters.direction === 'asc' ? 'desc' : 'asc', page: 0 })}>{filters.direction === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</button>
            <label htmlFor="page-size">Rows</label>
            <select id="page-size" className="form-control form-control-small" value={filters.size ?? 10} onChange={(event) => setFilters({ ...filters, size: Number(event.target.value), page: 0 })}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select>
          </div>
        </div>
      </form>

      {page.isPending ? <LoadingPanel label="Loading catalogue records…" /> : null}
      {page.isError ? <ErrorPanel error={page.error} onRetry={() => void page.refetch()} /> : null}
      {page.data && results.length === 0 ? <EmptyPanel title={hasFilters ? 'No matching resources' : 'The catalogue is empty'} description={hasFilters ? 'Try a different title, category or resource type, or clear the filters.' : 'Add the first resource to the catalogue.'} action={!hasFilters ? <Link className="button button-primary" to="/resources/new"><Plus size={15} /> Add resource</Link> : undefined} /> : null}

      {page.data && results.length > 0 ? (
        <section className="panel table-panel" aria-label="Resource catalogue">
          <div className="table-wrap">
            <table className="data-table resource-table">
              <thead><tr><th scope="col">Resource</th><th scope="col">Category &amp; type</th><th scope="col">Subject &amp; term</th><th scope="col">PDFs</th><th scope="col">Access activity</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
              <tbody>{results.map((resource) => (
                <tr key={resource.id}>
                  <td><div className="resource-cell"><Link className="resource-title-link" to={`/resources/${resource.id}`}>{resource.title}</Link>{resource.sample ? <span className="sample-mark">Sample</span> : null}{resource.description ? <span className="resource-description-cell">{resource.description}</span> : null}</div></td>
                  <td><span>{resource.category}</span><small className="cell-secondary">{resource.resourceType}</small></td>
                  <td><span>{resource.subject || '—'}</span><small className="cell-secondary">{resource.academicTerm || '—'}</small></td>
                  <td><span className="attachment-count">{(resource.attachmentCount ?? 0).toLocaleString('en')}</span><small className="cell-secondary">{resource.attachmentCount === 1 ? 'document' : 'documents'}</small></td>
                  <td><span>{resource.accessCount.toLocaleString('en')} {resource.accessCount === 1 ? 'access' : 'accesses'}</span><small className="cell-secondary">{formatDate(resource.lastAccessed)}</small></td>
                  <td><div className="row-actions"><Link className="icon-button" aria-label={`Edit ${resource.title}`} title="Edit resource" to={`/resources/${resource.id}/edit`} state={{ resource }}><Pencil size={15} /></Link><button className="icon-button icon-danger" type="button" aria-label={`Delete ${resource.title}`} title="Delete resource" disabled={deletion.isPending} onClick={() => void removeResource(resource)}><Trash2 size={15} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <span>Page {currentPage + 1} of {Math.max(totalPages, 1)}</span>
            <div className="pagination-actions"><button className="button button-secondary" type="button" disabled={currentPage <= 0 || page.isFetching} onClick={() => setFilters({ ...filters, page: currentPage - 1 })}><ChevronLeft size={16} /> Previous</button><button className="button button-secondary" type="button" disabled={currentPage + 1 >= totalPages || page.isFetching} onClick={() => setFilters({ ...filters, page: currentPage + 1 })}>Next <ChevronRight size={16} /></button></div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
