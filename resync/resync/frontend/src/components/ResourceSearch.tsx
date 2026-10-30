import { useEffect, useId, useState } from 'react';
import { AlertCircle, ArrowUpRight, LoaderCircle, Search, X } from 'lucide-react';
import { useResourceSearch } from '../api/queries';
import type { Resource } from '../api/types';
import { ApiClientError } from '../api/client';
import { resourceMetadataSummary } from '../api/display';

interface ResourceSearchProps {
  onSelect: (resource: Resource) => void;
  compact?: boolean;
  placeholder?: string;
}

export default function ResourceSearch({ onSelect, compact = false, placeholder = 'Title, subject, description or tag' }: ResourceSearchProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  const search = useResourceSearch(debounced);
  const typing = query.trim() !== debounced;
  const visible = query.trim().length > 0;
  const errorText = search.error instanceof ApiClientError
    ? search.error.message
    : 'The catalogue search is temporarily unavailable.';

  return (
    <div className={`resource-search ${compact ? 'resource-search-compact' : ''}`}>
      <label className="search-label" htmlFor={`${id}-search`}>Find a resource by name or topic</label>
      <div className="search-field-wrap">
        <Search size={18} aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          maxLength={160}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label="Search by title, subject, description or tags"
          aria-controls={`${id}-results`}
          aria-describedby={`${id}-help`}
          autoComplete="off"
        />
        {visible ? (
          <button className="icon-button search-clear" type="button" aria-label="Clear search" onClick={() => { setQuery(''); setDebounced(''); }}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="search-help" id={`${id}-help`}>Search the catalogue by title, subject, description or supported tags.</p>

      {visible ? (
        <div className="search-results" id={`${id}-results`} aria-live="polite">
          {typing || search.isFetching ? (
            <div className="search-feedback"><LoaderCircle size={15} className="spin" aria-hidden="true" /> Searching catalogue…</div>
          ) : search.isError ? (
            <div className="search-feedback search-feedback-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{errorText}</span>
              <button type="button" className="text-button" onClick={() => void search.refetch()}>Retry</button>
            </div>
          ) : debounced && search.data?.items.length === 0 ? (
            <div className="search-feedback">No resources found for “{debounced}”. Try another title or topic.</div>
          ) : search.data?.items.length ? (
            <ul className="search-result-list" aria-label="Matching resources">
              {search.data.items.map((resource) => (
                <li key={resource.id}>
                  <button className="search-result" type="button" aria-label={`Open ${resource.title}`} onClick={() => { onSelect(resource); setQuery(''); setDebounced(''); }}>
                    <span className="search-result-main">
                      <strong>{resource.title}</strong>
                      <span className="search-result-metadata">{resourceMetadataSummary(resource)}</span>
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
