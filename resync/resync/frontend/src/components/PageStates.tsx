import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle, RotateCw } from 'lucide-react';
import { ApiClientError } from '../api/client';

export function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">ResourceSync</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

export function LoadingPanel({ label = 'Loading live data…' }: { label?: string }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={18} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiClientError ? error.message : 'Something went wrong while loading this data.';
  return (
    <div className="state-panel state-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div className="state-copy">
        <strong>Could not load this information</strong>
        <span>{message}</span>
      </div>
      {onRetry ? (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          <RotateCw size={15} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyPanel({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="state-panel state-empty">
      <div className="empty-mark" aria-hidden="true">—</div>
      <div className="state-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}
