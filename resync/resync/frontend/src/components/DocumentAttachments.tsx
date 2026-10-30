import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, FileText, Plus, Trash2 } from 'lucide-react';
import { ApiClientError, api } from '../api/client';
import { createPdfUploadEntries, formatBytes, uploadPdfEntries, type PdfUploadEntry, type PdfUploadStatus } from '../api/attachmentUploads';
import { useAttachmentPolicy, useDeleteAttachment, useResourceAttachments, useUploadAttachment } from '../api/queries';
import { EmptyPanel, ErrorPanel, LoadingPanel } from './PageStates';
import PdfUploadQueue from './PdfUploadQueue';

interface DocumentAttachmentsProps {
  resourceId: number;
  retryUploads?: PdfUploadEntry[];
}

export default function DocumentAttachments({ resourceId, retryUploads = [] }: DocumentAttachmentsProps) {
  const attachments = useResourceAttachments(resourceId);
  const policy = useAttachmentPolicy();
  const upload = useUploadAttachment();
  const deletion = useDeleteAttachment();
  const [queue, setQueue] = useState<PdfUploadEntry[]>(retryUploads);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [queueError, setQueueError] = useState('');
  const [viewerStatus, setViewerStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [viewerError, setViewerError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');

  const selected = useMemo(
    () => attachments.data?.find((attachment) => attachment.id === selectedId) ?? null,
    [attachments.data, selectedId],
  );

  useEffect(() => {
    if (!attachments.data) return;
    setSelectedId((current) => current !== null && attachments.data.some((item) => item.id === current)
      ? current
      : attachments.data[0]?.id ?? null);
  }, [attachments.data]);

  useEffect(() => {
    if (!selected) {
      setViewerStatus('idle');
      setViewerError('');
      return;
    }
    let cancelled = false;
    setViewerStatus('checking');
    setViewerError('');
    void api.checkAttachmentContent(resourceId, selected.id).then(() => {
      if (!cancelled) setViewerStatus('ready');
    }).catch((error: unknown) => {
      if (cancelled) return;
      setViewerStatus('error');
      setViewerError(error instanceof Error ? error.message : 'The PDF could not be opened.');
    });
    return () => { cancelled = true; };
  }, [resourceId, selected?.id]);

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!policy.data) {
      setQueueError('The PDF upload limit is not available yet. Retry the upload policy request before selecting files.');
      return;
    }
    setQueueError('');
    setQueue((current) => [...current, ...createPdfUploadEntries(files, policy.data.maxFileSizeBytes)]);
  }

  function removeFromQueue(key: string) {
    setQueue((current) => current.filter((entry) => entry.key !== key));
  }

  async function runUploads(status: PdfUploadStatus) {
    setQueueError('');
    setIsProcessing(true);
    try {
      const updated = await uploadPdfEntries(
        resourceId,
        queue,
        (id, file, idempotencyKey, onProgress) => upload.mutateAsync({ resourceId: id, file, idempotencyKey, onProgress }),
        setQueue,
        [status],
      );
      setQueue(updated);
    } finally {
      setIsProcessing(false);
    }
  }

  async function removeAttachment(attachmentId: number, filename: string) {
    if (!window.confirm(`Remove “${filename}” from this resource? The resource record and other PDFs will remain.`)) return;
    setActionError('');
    try {
      await deletion.mutateAsync({ resourceId, attachmentId });
      if (selectedId === attachmentId) setSelectedId(null);
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : 'The PDF could not be removed. Try again.');
    }
  }

  const queuedCount = queue.filter((entry) => entry.status === 'queued').length;
  const failedCount = queue.filter((entry) => entry.status === 'failed').length;

  return (
    <section className="panel pdf-manager-panel" aria-labelledby={`attachments-heading-${resourceId}`}>
      <div className="panel-head pdf-manager-heading">
        <div>
          <p className="eyebrow">LOCAL PDF ATTACHMENTS</p>
          <h2 className="panel-title" id={`attachments-heading-${resourceId}`}>Documents for this resource</h2>
          <p className="panel-subtitle">Stored locally and served by ResourceSync. Opening or switching PDFs does not record another resource access.</p>
        </div>
        {attachments.data ? <span className="pdf-count-mark">{attachments.data.length} {attachments.data.length === 1 ? 'PDF' : 'PDFs'}</span> : null}
      </div>

      {actionError ? <div className="notice-card notice-error" role="alert">{actionError}</div> : null}
      {attachments.isPending ? <LoadingPanel label="Loading PDF attachments…" /> : null}
      {attachments.isError ? <ErrorPanel error={attachments.error} onRetry={() => void attachments.refetch()} /> : null}
      {policy.isError ? <ErrorPanel error={policy.error} onRetry={() => void policy.refetch()} /> : null}
      {queueError ? <div className="notice-card notice-error" role="alert">{queueError}</div> : null}
      <div className="pdf-manager-controls">
        <label className={`button button-secondary pdf-select-button${!policy.data || isProcessing ? ' is-disabled' : ''}`}>
          <Plus size={15} /> Select PDF files
          <input type="file" accept="application/pdf,.pdf" multiple disabled={!policy.data || isProcessing} onChange={selectFiles} />
        </label>
        {queuedCount > 0 ? <button className="button button-primary" type="button" disabled={isProcessing || !policy.data} onClick={() => void runUploads('queued')}>{isProcessing ? 'Uploading…' : `Upload ${queuedCount} ${queuedCount === 1 ? 'PDF' : 'PDFs'}`}</button> : null}
        {failedCount > 0 ? <button className="button button-secondary" type="button" disabled={isProcessing || !policy.data} onClick={() => void runUploads('failed')}>Retry {failedCount} failed {failedCount === 1 ? 'PDF' : 'PDFs'}</button> : null}
        {policy.data ? <span className="field-help">Maximum {formatBytes(policy.data.maxFileSizeBytes)} per file. Files upload one at a time.</span> : policy.isPending ? <span className="field-help">Loading the server upload limit…</span> : null}
      </div>
      <PdfUploadQueue entries={queue} label="PDF upload status" onRemove={isProcessing ? undefined : removeFromQueue} />

      {attachments.data && attachments.data.length === 0 ? (
        <EmptyPanel title="No PDFs attached yet" description="Select one or more PDF files to store them alongside this resource. The reference field remains metadata only." />
      ) : null}
      {attachments.data && attachments.data.length > 0 ? (
        <div className="pdf-workbench">
          <div className="pdf-document-list" role="list" aria-label="Attached PDFs">
            {attachments.data.map((attachment) => (
              <div className={`pdf-document-item${selectedId === attachment.id ? ' is-selected' : ''}`} role="listitem" key={attachment.id}>
                <button className="pdf-document-select" type="button" aria-pressed={selectedId === attachment.id} onClick={() => setSelectedId(attachment.id)}>
                  <FileText size={17} aria-hidden="true" />
                  <span className="pdf-document-copy"><strong>{attachment.originalFilename}</strong><small>{formatBytes(attachment.sizeBytes)} · PDF · {new Date(attachment.uploadedAt).toLocaleDateString('en')}</small></span>
                </button>
                <div className="pdf-document-actions">
                  <a className="icon-button" href={api.attachmentDownloadUrl(resourceId, attachment.id)} aria-label={`Download ${attachment.originalFilename}`} title="Download PDF"><ArrowDownToLine size={15} /></a>
                  <a className="icon-button" href={api.attachmentContentUrl(resourceId, attachment.id)} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.originalFilename} in a new tab`} title="Open in new tab"><ArrowUpRight size={15} /></a>
                  <button className="icon-button icon-danger" type="button" aria-label={`Remove ${attachment.originalFilename}`} title="Remove PDF" disabled={deletion.isPending} onClick={() => void removeAttachment(attachment.id, attachment.originalFilename)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pdf-viewer-shell">
            {selected ? <div className="pdf-viewer-toolbar"><strong>{selected.originalFilename}</strong><span>Browser PDF viewer</span></div> : null}
            {viewerStatus === 'checking' ? <LoadingPanel label="Checking the stored PDF before opening it…" /> : null}
            {viewerStatus === 'error' ? <div className="notice-card notice-error" role="alert">{viewerError}</div> : null}
            {viewerStatus === 'ready' && selected ? <iframe key={selected.id} className="pdf-viewer-frame" src={api.attachmentContentUrl(resourceId, selected.id)} title={`PDF document: ${selected.originalFilename}`} loading="lazy" /> : null}
            {!selected && attachments.data?.length ? <div className="notice-card notice-neutral">Select a PDF from the list to open it here.</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
