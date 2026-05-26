import { useRef, useState } from 'react';
import { uploadDocument } from '../api/upload';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/FileUploader.css';

const ALLOWED = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};

export default function FileUploader({ workspaceId, onUploadSuccess, onUploadError, disabled = false }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (!ALLOWED[file.type] && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      const msg = t('upload_supported_types');
      setStatus({ type: 'error', text: msg });
      onUploadError?.(msg);
      return;
    }

    setStatus({ type: 'loading', text: t('uploading') });

    try {
      const result = await uploadDocument(file, workspaceId);
      const chunks = result.chunk_count ?? result.chunks ?? '?';
      setStatus({ type: 'success', text: `${t('indexed')} — ${chunks} chunks` });
      setUploads((prev) => [{ name: file.name, chunks }, ...prev].slice(0, 5));
      onUploadSuccess?.(result);
      setTimeout(() => setStatus(null), 3000);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || err.message
        || t('upload_failed');
      setStatus({ type: 'error', text: msg });
      onUploadError?.(msg);
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="file-uploader">
      <div
        className={`upload-drop-zone ${dragging ? 'dragging' : ''} ${status?.type === 'loading' ? 'loading' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="upload-file-input"
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(event) => handleFile(event.target.files?.[0])}
          disabled={status?.type === 'loading' || !workspaceId || disabled}
        />
        <span className="upload-icon">↑</span>
        <div className="upload-label-text">
          {workspaceId && !disabled ? t('drop_file_or_click') : t('select_workspace_first')}
        </div>
        <span className="upload-accepted">{t('upload_supported_types')}</span>
      </div>

      {status && (
        <div className={`upload-status ${status.type}`}>
          {status.type === 'loading' && (
            <>
              <span className="upload-spinner" />
              <span className="upload-dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </>
          )}
          {status.type === 'success' && '✓'}
          {status.type === 'error' && '✗'}
          <span>{status.text}</span>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="recent-uploads">
          <div className="recent-uploads-title">{t('recent_uploads')}</div>
          {uploads.map((upload, index) => (
            <div key={index} className="recent-upload-item">
              <span className="recent-upload-name" title={upload.name}>{upload.name}</span>
              <span className="recent-upload-chunks">{upload.chunks}c</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
