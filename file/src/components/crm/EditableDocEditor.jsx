'use client';
import React, { useState, useCallback } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { createEditableDoc, updateEditableDoc, deleteEditableDoc } from '@/lib/actions/editable-docs';
import { EDITABLE_DOC_CATEGORIES } from '@/lib/utils/constants';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'blockquote', 'code-block', 'link',
];

const EditableDocEditor = ({ doc = null, entityType = 'global', entityId = null, entityName = '' }) => {
  const router = useRouter();
  const isNew = !doc;

  const [title, setTitle] = useState(doc?.title || '');
  const [content, setContent] = useState(doc?.content || '');
  const [category, setCategory] = useState(doc?.category || 'other');
  const [isPortalVisible, setIsPortalVisible] = useState(doc?.isPortalVisible || false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const result = await createEditableDoc({
          title,
          content,
          entityType,
          entityId,
          category,
          isPortalVisible,
        });
        if (result.success) {
          toast.success('Document created');
          router.push(`/docs/${result.id}`);
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await updateEditableDoc(doc.id, {
          title,
          content,
          category,
          isPortalVisible,
        });
        if (result.success) {
          toast.success('Document saved');
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error('Failed to save document');
    } finally {
      setSaving(false);
    }
  }, [title, content, category, isPortalVisible, entityType, entityId, doc, isNew, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const result = await deleteEditableDoc(doc.id);
      if (result.success) {
        toast.success('Document deleted');
        router.push('/docs');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [doc, router]);

  const scopeLabel = entityType === 'project'
    ? `Project: ${entityName}`
    : entityType === 'client'
    ? `Client: ${entityName}`
    : 'Global (Company-wide)';

  return (
    <div className="row gy-4">
      {/* Main editor area */}
      <div className={doc ? 'col-lg-8' : 'col-12'}>
        <div className="card h-100">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">{isNew ? 'New Document' : 'Edit Document'}</h6>
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => router.back()}
              >
                Cancel
              </button>
              <button
                className="btn btn-success btn-sm d-flex align-items-center gap-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <Icon icon="mdi:content-save-outline" className="text-lg" />
                )}
                {isNew ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {/* Scope badge */}
            <div className="mb-3">
              <span className="badge bg-primary-600 bg-opacity-25 text-primary-600 px-12 py-6 text-sm">
                <Icon icon={entityType === 'project' ? 'solar:folder-with-files-outline' : entityType === 'client' ? 'mdi:account-tie' : 'mdi:earth'} className="me-1" />
                {scopeLabel}
              </span>
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="Document title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Category + Portal visibility */}
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={saving}
                >
                  {EDITABLE_DOC_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="portalVisible"
                    checked={isPortalVisible}
                    onChange={(e) => setIsPortalVisible(e.target.checked)}
                    disabled={saving}
                  />
                  <label className="form-check-label" htmlFor="portalVisible">
                    Visible in client portal
                  </label>
                </div>
              </div>
            </div>

            {/* Editor */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Content</label>
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                placeholder="Start writing..."
                readOnly={saving}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metadata sidebar (edit mode only) */}
      {doc && (
        <div className="col-lg-4">
          <div className="card mb-3">
            <div className="card-header">
              <h6 className="mb-0">Details</h6>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-3">
                <div>
                  <span className="text-secondary-light text-sm">Created by</span>
                  <p className="mb-0 fw-medium">{doc.creatorName || '—'}</p>
                </div>
                <div>
                  <span className="text-secondary-light text-sm">Created</span>
                  <p className="mb-0 fw-medium">
                    {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {doc.updaterName && (
                  <div>
                    <span className="text-secondary-light text-sm">Last edited by</span>
                    <p className="mb-0 fw-medium">{doc.updaterName}</p>
                  </div>
                )}
                <div>
                  <span className="text-secondary-light text-sm">Last edited</span>
                  <p className="mb-0 fw-medium">
                    {new Date(doc.lastEditedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {doc.entityName && (
                  <div>
                    <span className="text-secondary-light text-sm">
                      {doc.entityType === 'project' ? 'Project' : 'Client'}
                    </span>
                    <p className="mb-0">
                      <a
                        href={doc.entityType === 'project' ? `/projects/${doc.entityId}` : `/clients/${doc.entityId}`}
                        className="text-primary-600 hover-text-primary"
                      >
                        {doc.entityName}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delete */}
          <div className="card border-danger-subtle">
            <div className="card-body">
              {showDeleteConfirm ? (
                <div>
                  <p className="text-sm text-danger mb-2">Are you sure? This cannot be undone.</p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-danger btn-sm flex-fill d-flex align-items-center justify-content-center gap-1"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <Icon icon="mdi:delete-outline" />
                      )}
                      Delete
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm flex-fill"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Icon icon="mdi:delete-outline" />
                  Delete Document
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableDocEditor;
