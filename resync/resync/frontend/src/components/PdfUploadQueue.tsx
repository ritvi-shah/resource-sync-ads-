import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react';
import { formatBytes, overallUploadProgress, type PdfUploadEntry } from '../api/attachmentUploads';

interface PdfUploadQueueProps {
  entries: PdfUploadEntry[];
  onRemove?: (key: string) => void;
  label?: string;
}

const statusText: Record<PdfUploadEntry['status'], string> = {
  queued: 'Waiting',
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  failed: 'Failed',
  rejected: 'Not accepted',
};

export default function PdfUploadQueue({ entries, onRemove, label = 'Selected PDFs' }: PdfUploadQueueProps) {
  if (!entries.length) return null;
  const overall = overallUploadProgress(entries);
  const uploaded = entries.filter((entry) => entry.status === 'uploaded').length;
  const resolved = entries.filter((entry) => ['uploaded', 'failed', 'rejected'].includes(entry.status)).length;

  return (
    <section className="pdf-upload-queue" aria-label={label}>
      <div className="pdf-overall-progress">
        <div className="pdf-overall-heading"><span>Overall upload progress</span><strong>{overall}%</strong></div>
        <progress max={100} value={overall} aria-label="Overall PDF upload progress" />
        <small><span>{uploaded} of {entries.length} uploaded</span><span aria-hidden="true"> · </span><span>{resolved} of {entries.length} processed</span></small>
      </div>
      <ul className="pdf-upload-list">
        {entries.map((entry) => (
          <li className={`pdf-upload-item pdf-upload-${entry.status}`} key={entry.key}>
            <div className="pdf-upload-main">
              <span className="pdf-upload-name" title={entry.file.name}>{entry.file.name}</span>
              <span className="pdf-upload-size">{formatBytes(entry.file.size)}</span>
              <span className={`pdf-upload-state pdf-upload-state-${entry.status}`} aria-live="polite">
                {entry.status === 'uploaded' ? <Check size={13} aria-hidden="true" /> : null}
                {entry.status === 'uploading' ? <LoaderCircle size={13} aria-hidden="true" className="pdf-spinner" /> : null}
                {entry.status === 'failed' || entry.status === 'rejected' ? <AlertCircle size={13} aria-hidden="true" /> : null}
                {statusText[entry.status]}
              </span>
              {onRemove && entry.status !== 'uploading' ? (
                <button className="icon-button pdf-upload-remove" type="button" aria-label={`Remove ${entry.file.name} from upload list`} onClick={() => onRemove(entry.key)}>
                  <X size={14} />
                </button>
              ) : null}
            </div>
            {entry.status === 'uploading' ? <progress max={100} value={Math.round(entry.progress * 100)} aria-label={`Upload progress for ${entry.file.name}`} /> : null}
            {entry.error ? <p className={`pdf-upload-error ${entry.status === 'rejected' ? 'pdf-upload-rejection' : ''}`} role={entry.status === 'rejected' ? 'alert' : 'status'}>{entry.error}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
