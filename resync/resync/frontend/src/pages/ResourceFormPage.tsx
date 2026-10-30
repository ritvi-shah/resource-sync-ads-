import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAttachmentPolicy, useCreateResource, useUpdateResource, useUploadAttachment } from '../api/queries';
import { ApiClientError, api } from '../api/client';
import type { Resource, ResourceWriteRequest } from '../api/types';
import { createPdfUploadEntries, formatBytes, uploadPdfEntries, type PdfUploadEntry } from '../api/attachmentUploads';
import { findResourceForEditing } from '../api/findResourceForEditing';
import { ErrorPanel, LoadingPanel, PageHeading } from '../components/PageStates';
import PdfUploadQueue from '../components/PdfUploadQueue';

interface FormValues {
  title: string;
  description: string;
  category: string;
  resourceType: string;
  subject: string;
  academicTerm: string;
  resourceUrl: string;
  resourceReference: string;
  tags: string;
}
const blankForm: FormValues = { title: '', description: '', category: '', resourceType: '', subject: '', academicTerm: '', resourceUrl: '', resourceReference: '', tags: '' };
const limits: Record<string, number> = { title: 160, description: 4000, category: 80, resourceType: 80, subject: 120, academicTerm: 80, resourceUrl: 2048, resourceReference: 2048, tags: 30 * 48 + 29 * 2 };
function toForm(resource: Resource): FormValues {
  return { title: resource.title, description: resource.description ?? '', category: resource.category, resourceType: resource.resourceType, subject: resource.subject ?? '', academicTerm: resource.academicTerm ?? '', resourceUrl: resource.resourceUrl ?? '', resourceReference: resource.resourceReference ?? '', tags: resource.tags.join(', ') };
}
function validHttpUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.host);
  } catch { return false; }
}

export default function ResourceFormPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const editing = rawId !== undefined && rawId !== 'new';
  const validId = !editing || (Number.isSafeInteger(id) && id > 0);
  const location = useLocation();
  const routeResource = (location.state as { resource?: Resource } | null)?.resource;
  const seedResource = routeResource?.id === id ? routeResource : undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editLookup = useQuery({
    queryKey: ['resources', 'edit-metadata', id],
    queryFn: () => findResourceForEditing(id),
    enabled: editing && validId && !seedResource,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const create = useCreateResource();
  const update = useUpdateResource();
  const attachmentPolicy = useAttachmentPolicy();
  const uploadAttachment = useUploadAttachment();
  const [values, setValues] = useState<FormValues>(blankForm);
  const [initializedId, setInitializedId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stagedPdfs, setStagedPdfs] = useState<PdfUploadEntry[]>([]);
  const [pdfSelectionError, setPdfSelectionError] = useState('');

  const resource = seedResource ?? (editLookup.data?.id === id ? editLookup.data : undefined);
  useEffect(() => {
    if (editing && resource && initializedId !== resource.id) {
      setValues(toForm(resource));
      setInitializedId(resource.id);
    }
    if (!editing && initializedId !== 0) {
      setValues(blankForm);
      setInitializedId(0);
    }
  }, [editing, resource, initializedId]);

  function change(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setServerFieldErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  }

  function selectPdfs(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    if (!attachmentPolicy.data) {
      setPdfSelectionError('The PDF upload limit is not available yet. Retry the upload policy request before selecting files.');
      return;
    }
    setPdfSelectionError('');
    setStagedPdfs((current) => [...current, ...createPdfUploadEntries(files, attachmentPolicy.data.maxFileSizeBytes)]);
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = 'Enter a title.';
    if (values.title.length > 160) next.title = 'Title must be 160 characters or fewer.';
    if (!values.category.trim()) next.category = 'Enter a category.';
    if (values.category.length > 80) next.category = 'Category must be 80 characters or fewer.';
    if (!values.resourceType.trim()) next.resourceType = 'Enter a resource type.';
    if (values.resourceType.length > 80) next.resourceType = 'Resource type must be 80 characters or fewer.';
    if (values.description.length > 4000) next.description = 'Description must be 4,000 characters or fewer.';
    if (values.subject.length > 120) next.subject = 'Subject must be 120 characters or fewer.'
    if (values.academicTerm.length > 80) next.academicTerm = 'Academic term must be 80 characters or fewer.';
    if (values.resourceUrl.length > 2048) next.resourceUrl = 'URL must be 2,048 characters or fewer.';
    else if (!validHttpUrl(values.resourceUrl)) next.resourceUrl = 'Enter an absolute HTTP or HTTPS URL.';
    if (values.resourceReference.length > 2048) next.resourceReference = 'Reference must be 2,048 characters or fewer.';
    const tags = values.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > 30) next.tags = 'Use 30 tags or fewer.';
    else if (tags.some((tag) => tag.length > 48)) next.tags = 'Each tag must be 48 characters or fewer.';
    return next;
  }

  async function createWithProgrammaticId(payload: Omit<ResourceWriteRequest, 'id'>): Promise<number> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = await api.listResources({ page: 0, size: 1, sort: 'id', direction: 'desc' });
      const nextId = (latest.items[0]?.id ?? 0) + 1;
      if (!Number.isSafeInteger(nextId) || nextId > 2_147_483_647) {
        throw new ApiClientError(409, 'ID_SPACE_EXHAUSTED', 'A new internal identifier could not be assigned. Contact the catalogue administrator.');
      }
      try {
        const created = await create.mutateAsync({ ...payload, id: nextId });
        return created.id;
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 409 || attempt === 2) throw error;
      }
    }
    throw new ApiClientError(409, 'RESOURCE_CREATE_CONFLICT', 'The resource could not be assigned an available internal ID. Try again.');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError('');
    setServerFieldErrors({});
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !validId || (editing && !resource)) return;
    if (stagedPdfs.some((entry) => entry.status === 'rejected')) {
      setPdfSelectionError('Remove files that were not accepted before saving the resource.');
      return;
    }
    const tags = values.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 30);
    const fields = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      resourceType: values.resourceType.trim(),
      subject: values.subject.trim(),
      academicTerm: values.academicTerm.trim(),
      resourceUrl: values.resourceUrl.trim(),
      resourceReference: values.resourceReference.trim(),
      tags,
    };
    setSubmitting(true);
    try {
      let savedId = id;
      if (editing) await update.mutateAsync({ id, resource: { ...fields, id } });
      else savedId = await createWithProgrammaticId(fields);

      if (stagedPdfs.some((entry) => entry.status === 'queued')) {
        const uploaded = await uploadPdfEntries(
          savedId,
          stagedPdfs,
          (resourceId, file, idempotencyKey, onProgress) => uploadAttachment.mutateAsync({ resourceId, file, idempotencyKey, onProgress }),
          setStagedPdfs,
          ['queued'],
        );
        setStagedPdfs(uploaded);
        void queryClient.invalidateQueries({ queryKey: ['resources'] });
        const successes = uploaded.filter((entry) => entry.status === 'uploaded').length;
        const failed = uploaded.filter((entry) => entry.status === 'failed');
        const prefix = editing ? 'Resource changes saved. ' : '';
        const notice = failed.length
          ? `${prefix}${successes} PDF${successes === 1 ? '' : 's'} uploaded. ${failed.length} file${failed.length === 1 ? '' : 's'} need a retry; successful uploads were kept.`
          : `${prefix}${successes} PDF${successes === 1 ? '' : 's'} uploaded successfully.`;
        navigate(`/resources/${savedId}`, { replace: true, state: { notice, retryUploads: failed } });
        return;
      }
      navigate('/resources', { replace: true, state: { notice: editing ? 'Resource changes saved.' : 'Resource added to the catalogue.' } });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
        setServerFieldErrors(error.details);
      } else {
        setSubmitError('The resource could not be saved. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!validId) return <div className="page-stack"><PageHeading title="Edit resource" description="The resource address is invalid." /><div className="notice-card notice-error" role="alert">Select a resource by name from the library before editing it.</div><Link className="button button-secondary" to="/resources"><ArrowLeft size={15} /> Back to library</Link></div>;
  if (editing && !resource && editLookup.isPending) return <div className="page-stack"><PageHeading title="Edit resource" description="Loading the selected record." /><LoadingPanel label="Loading catalogue metadata…" /></div>;
  if (editing && !resource && editLookup.isError) return <div className="page-stack"><PageHeading title="Edit resource" description="The resource could not be loaded." /><ErrorPanel error={editLookup.error} onRetry={() => void editLookup.refetch()} /><Link className="button button-secondary" to="/resources"><ArrowLeft size={15} /> Back to library</Link></div>;
  if (editing && !resource) return <div className="page-stack"><PageHeading title="Edit resource" description="The resource could not be found in the catalogue." /><div className="notice-card notice-error" role="alert">Return to the Resource Library and select a record by name before editing.</div><Link className="button button-secondary" to="/resources"><ArrowLeft size={15} /> Back to library</Link></div>;

  const formDisabled = submitting || create.isPending || update.isPending;
  const input = (field: keyof FormValues, label: string, maxLength: number, required = false, help?: string) => {
    const fieldError = errors[field] || serverFieldErrors[field] || '';
    return (
      <label className="form-field" htmlFor={`resource-${field}`}>
        <span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span>
        {field === 'description' || field === 'resourceReference' ? (
          <textarea id={`resource-${field}`} className="form-control" value={values[field]} maxLength={maxLength} required={required} disabled={formDisabled} onChange={(event) => change(field, event.target.value)} rows={field === 'description' ? 4 : 2} aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? `${field}-error` : help ? `${field}-help` : undefined} />
        ) : (
          <input id={`resource-${field}`} className="form-control" value={values[field]} maxLength={maxLength} required={required} disabled={formDisabled} onChange={(event) => change(field, event.target.value)} aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? `${field}-error` : help ? `${field}-help` : undefined} />
        )}
        {help ? <small id={`${field}-help`} className="field-help">{help}</small> : null}
        {fieldError ? <small id={`${field}-error`} className="field-error">{fieldError}</small> : null}
      </label>
    );
  };

  const tagsError = errors.tags || serverFieldErrors.tags || '';

  return (
    <div className="page-stack">
      <PageHeading title={editing ? 'Edit resource' : 'Add a resource'} description={editing ? `Update the metadata for “${resource?.title ?? 'this resource'}”.` : 'Add a catalogue record; internal IDs are assigned automatically.'} action={<Link className="button button-secondary" to="/resources"><ArrowLeft size={15} /> Library</Link>} />
      {submitError ? <div className="notice-card notice-error" role="alert">{submitError}</div> : null}
      <form className="panel resource-form-panel" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-intro"><p><strong>Catalogue metadata</strong><span>{editing ? 'Changes update the stored record without changing its access history.' : 'Identifiers are generated by the application. No ID entry is needed.'}</span></p><span className="required-note">* Required</span></div>
        <div className="resource-form-grid">
          {input('title', 'Title', 160, true)}
          {input('category', 'Category', 80, true)}
          {input('resourceType', 'Resource type', 80, true)}
          {input('subject', 'Subject', 120)}
          {input('academicTerm', 'Academic term', 80)}
          {input('resourceUrl', 'Resource URL', 2048, false, 'Optional. Use an absolute HTTP or HTTPS address; the backend will not open local paths.')}
          {input('description', 'Description', 4000)}
          {input('resourceReference', 'Reference metadata', 2048, false, 'Optional opaque reference only; it is not a local file path.')}
          <label className="form-field form-span-full" htmlFor="resource-tags"><span>Tags</span><input id="resource-tags" className="form-control" value={values.tags} maxLength={limits.tags} disabled={formDisabled} onChange={(event) => change('tags', event.target.value)} placeholder="Comma-separated, up to 30 tags" aria-invalid={tagsError ? true : undefined} aria-describedby={tagsError ? 'tags-error' : 'tags-help'} /><small id="tags-help" className="field-help">Separate tags with commas. Each tag can be up to 48 characters.</small>{tagsError ? <small id="tags-error" className="field-error">{tagsError}</small> : null}</label>
        </div>
        <section className="form-attachment-section" aria-labelledby="resource-pdfs-heading">
            <div className="form-attachment-heading"><div><p className="eyebrow">OPTIONAL FILES</p><h2 id="resource-pdfs-heading">Attach PDF documents</h2><p>Metadata is saved first. Selected PDFs are then validated and uploaded one at a time. Existing attachments are preserved; manage them from the resource details page.</p></div>
              <label className={`button button-secondary pdf-select-button${!attachmentPolicy.data ? ' is-disabled' : ''}`}>
                Select PDFs
                <input type="file" accept="application/pdf,.pdf" multiple disabled={!attachmentPolicy.data || formDisabled} onChange={selectPdfs} />
              </label>
            </div>
            {attachmentPolicy.isPending ? <small className="field-help">Loading the server upload limit…</small> : null}
            {attachmentPolicy.isError ? <ErrorPanel error={attachmentPolicy.error} onRetry={() => void attachmentPolicy.refetch()} /> : null}
            {attachmentPolicy.data ? <small className="field-help">PDF only · up to {formatBytes(attachmentPolicy.data.maxFileSizeBytes)} per file · uploads are sequential.</small> : null}
            {pdfSelectionError ? <div className="notice-card notice-error" role="alert">{pdfSelectionError}</div> : null}
            <PdfUploadQueue entries={stagedPdfs} label="PDFs selected for this resource" onRemove={formDisabled ? undefined : (key) => { setStagedPdfs((current) => current.filter((entry) => entry.key !== key)); setPdfSelectionError(''); }} />
        </section>
        {resource?.sample ? <div className="notice-card notice-neutral">This is a demonstration sample, not an official university document. Editing it will preserve its sample marker.</div> : null}
        <div className="form-footer"><span>{editing ? 'Existing PDFs stay attached. New selections upload only after metadata saves.' : 'The resource record is saved before selected PDFs are uploaded.'}</span><div><Link className="button button-secondary" to="/resources">Cancel</Link><button className="button button-primary" type="submit" disabled={formDisabled || (editing && !resource) || stagedPdfs.some((entry) => entry.status === 'rejected')}><Save size={16} /> {formDisabled ? 'Saving…' : editing ? 'Save changes' : 'Add resource'}</button></div></div>
      </form>
    </div>
  );
}
