'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { deleteDocument, toggleDocumentPortalVisibility } from '@/lib/actions/documents';
import { formatDate } from '@/lib/utils/formatters';
import { DOCUMENT_CATEGORIES } from '@/lib/utils/constants';

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return 'mdi:file-image-outline';
  if (mimeType === 'application/pdf') return 'mdi:file-pdf-box';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'mdi:file-word-outline';
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'mdi:file-excel-outline';
  if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return 'mdi:file-powerpoint-outline';
  if (mimeType?.startsWith('video/')) return 'mdi:file-video-outline';
  if (mimeType?.startsWith('audio/')) return 'mdi:file-music-outline';
  if (mimeType?.includes('zip') || mimeType?.includes('tar') || mimeType?.includes('gzip')) return 'mdi:folder-zip-outline';
  return 'mdi:file-outline';
}

const DocumentVault = ({ clientId, projectId, documents: initialDocs = [], mode = 'crm', showContext = false }) => {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [docs, setDocs] = useState(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadPortalVisible, setUploadPortalVisible] = useState(false);

  const filteredDocs = categoryFilter === 'all'
    ? docs
    : docs.filter((d) => d.category === categoryFilter);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (clientId) formData.append('clientId', clientId);
      if (projectId) formData.append('projectId', projectId);
      formData.append('category', uploadCategory);
      if (uploadDescription) formData.append('description', uploadDescription);
      formData.append('isPortalVisible', String(uploadPortalVisible));

      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (data.error) {
          toast.error(`${file.name}: ${data.error}`);
        } else {
          setDocs((prev) => [data.document, ...prev]);
          successCount++;
        }
      } catch {
        toast.error(`${file.name}: Upload failed`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`);
      setUploadDescription('');
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDownload = async (docId, fileName) => {
    try {
      const res = await fetch(`/api/documents/${docId}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (docId, fileName) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    const res = await deleteDocument(docId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success('Document deleted');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const handleToggleVisibility = async (docId) => {
    const res = await toggleDocumentPortalVisibility(docId);
    if (res?.error) {
      toast.error(res.error);
    } else {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, isPortalVisible: res.isPortalVisible } : d
        )
      );
      toast.success(res.isPortalVisible ? 'Visible to client' : 'Hidden from client');
    }
  };

  const isPortalMode = mode === 'portal';

  return (
    <div>
      {/* Upload Zone (CRM only) */}
      {!isPortalMode && (
        <div className="card mb-4">
          <div className="card-body">
            <div
              className={`p-4 text-center rounded ${dragOver ? 'border border-2' : 'border border-dashed'}`}
              style={{
                borderColor: dragOver ? '#03FF00' : 'rgba(255,255,255,0.15)',
                background: dragOver ? 'rgba(3,255,0,0.05)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon icon="mdi:cloud-upload-outline" className="text-secondary-light mb-2" style={{ fontSize: '32px' }} />
              <p className="text-secondary-light text-sm mb-1">
                {uploading ? 'Uploading...' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-secondary-light text-xs mb-0">Max 50MB per file</p>
              {uploading && <span className="spinner-border spinner-border-sm text-secondary-light mt-2" />}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="d-none"
              onChange={(e) => handleUpload(e.target.files)}
            />

            <div className="row g-2 mt-3">
              <div className="col-sm-4">
                <label className="form-label text-secondary-light text-xs">Category</label>
                <select
                  className="form-select form-select-sm bg-base text-white"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-sm-5">
                <label className="form-label text-secondary-light text-xs">Description (optional)</label>
                <input
                  type="text"
                  className="form-control form-control-sm bg-base text-white"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
              <div className="col-sm-3 d-flex align-items-end">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="portalVisible"
                    checked={uploadPortalVisible}
                    onChange={(e) => setUploadPortalVisible(e.target.checked)}
                  />
                  <label className="form-check-label text-secondary-light text-xs" htmlFor="portalVisible">
                    Visible to client
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter + File List */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h6 className="text-white fw-semibold mb-0">
            {isPortalMode ? 'Project Files' : 'Documents'} ({filteredDocs.length})
          </h6>
          <select
            className="form-select form-select-sm bg-base text-white"
            style={{ maxWidth: '160px' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="card-body d-flex flex-column justify-content-center align-items-center py-5">
            <Icon icon="mdi:folder-file-outline" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
            <p className="text-secondary-light text-sm mb-0">
              {isPortalMode ? 'No files shared yet.' : 'No documents uploaded yet.'}
            </p>
          </div>
        ) : (
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className={`table ${isPortalMode ? '' : 'table-dark'} table-hover mb-0`}>
                <thead>
                  <tr className="text-secondary-light text-xs">
                    <th>File</th>
                    <th>Category</th>
                    {showContext && <th>Client / Project</th>}
                    <th>Size</th>
                    {!isPortalMode && <th>Uploader</th>}
                    <th>Date</th>
                    {!isPortalMode && <th>Portal</th>}
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const catObj = DOCUMENT_CATEGORIES.find((c) => c.value === doc.category);
                    return (
                      <tr key={doc.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Icon icon={getFileIcon(doc.mimeType)} style={{ fontSize: '20px', color: '#94a3b8' }} />
                            <div>
                              <span className={`${isPortalMode ? '' : 'text-white'} text-sm fw-medium d-block`}>
                                {doc.fileName}
                              </span>
                              {doc.description && (
                                <span className="text-secondary-light text-xs">{doc.description}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-secondary bg-opacity-25 text-secondary-light text-xs">
                            {catObj?.label || doc.category}
                          </span>
                        </td>
                        {showContext && (
                          <td>
                            <span className="text-secondary-light text-sm">
                              {doc.clientName && (
                                <a href={`/clients/${doc.clientId}`} className="hover-text-primary">{doc.clientName}</a>
                              )}
                              {doc.clientName && doc.projectName && ' / '}
                              {doc.projectName && (
                                <a href={`/projects/${doc.projectId}`} className="hover-text-primary">{doc.projectName}</a>
                              )}
                              {!doc.clientName && !doc.projectName && '—'}
                            </span>
                          </td>
                        )}
                        <td><span className="text-secondary-light text-sm">{formatFileSize(doc.fileSize)}</span></td>
                        {!isPortalMode && (
                          <td><span className="text-secondary-light text-sm">{doc.uploaderName || '—'}</span></td>
                        )}
                        <td><span className="text-secondary-light text-sm">{formatDate(doc.createdAt)}</span></td>
                        {!isPortalMode && (
                          <td>
                            <button
                              className={`btn btn-sm ${doc.isPortalVisible ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                              title={doc.isPortalVisible ? 'Visible to client' : 'Hidden from client'}
                              onClick={() => handleToggleVisibility(doc.id)}
                            >
                              <Icon
                                icon={doc.isPortalVisible ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}
                                style={{ fontSize: '14px' }}
                              />
                            </button>
                          </td>
                        )}
                        <td>
                          <div className="d-flex gap-1">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              title="Download"
                              onClick={() => handleDownload(doc.id, doc.fileName)}
                            >
                              <Icon icon="mdi:download" style={{ fontSize: '14px' }} />
                            </button>
                            {!isPortalMode && (
                              <button
                                className="btn btn-outline-danger btn-sm"
                                title="Delete"
                                onClick={() => handleDelete(doc.id, doc.fileName)}
                              >
                                <Icon icon="mdi:trash-can-outline" style={{ fontSize: '14px' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentVault;
