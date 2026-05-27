import { useEffect, useRef, useState } from 'react';
import { uploadDocument } from '../api/upload';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/FileUploader.css';

const ALLOWED = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};

export default function FileUploader({
  workspaceId,
  onUploadSuccess,
  onUploadError,
  disabled = false,
  nameRequired = false,
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ type: 'idle' });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const isAllowedFile = (file) => ALLOWED[file.type] || file.name.match(/\.(pdf|docx|txt)$/i);

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const reset = () => {
    clearDismissTimer();
    setStatus({ type: 'idle' });
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (status.type === 'uploading' || disabled || !workspaceId) return;
    if (!isAllowedFile(file)) {
      setStatus({ type: 'error', message: 'Upload failed. Try again.' });
      onUploadError?.('Upload failed. Try again.');
      return;
    }

    clearDismissTimer();
    setDragging(false);
    setStatus({ type: 'uploading', filename: file.name });

    try {
      const result = await uploadDocument(file, workspaceId);
      const chunks = result.chunk_count ?? result.chunks ?? '?';
      setStatus({ type: 'success', filename: file.name, chunks });
      onUploadSuccess?.(result);
      clearDismissTimer();
      dismissTimerRef.current = window.setTimeout(() => {
        setStatus({ type: 'idle' });
        if (inputRef.current) inputRef.current.value = '';
      }, 3000);
    } catch (err) {
      const msg = 'Upload failed. Try again.';
      setStatus({ type: 'error', message: msg });
      onUploadError?.(msg);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (status.type !== 'uploading') handleFile(event.dataTransfer.files?.[0]);
  };

  const isBusy = status.type === 'uploading' || !workspaceId || disabled;

  useEffect(() => () => clearDismissTimer(), []);

  return (
    <div className="file-uploader">
      <div
        className={`upload-drop-zone ${dragging ? 'dragging' : ''} ${status.type === 'uploading' ? 'uploading' : ''}`}
        onDragOver={(event) => {
          if (isBusy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          if (!isBusy) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="upload-file-input"
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(event) => handleFile(event.target.files?.[0])}
          disabled={isBusy}
        />
        {status.type === 'idle' && (
          <div className="uploader-idle">
            <div className="uploader-icon">↑</div>
            <p className="uploader-primary">{!workspaceId ? t('select_project_first') : nameRequired ? t('name_project_first') : t('drop_or_click')}</p>
            <p className="uploader-hint">PDF, DOCX, TXT · max 50MB</p>
          </div>
        )}

        {status.type === 'uploading' && (
          <div className="uploader-uploading">
            <p className="uploader-filename" title={status.filename}>{status.filename}</p>
            <div className="uploader-progress">
              <div className="uploader-progress-bar" />
            </div>
            <p className="uploader-status">{t('uploading')}</p>
          </div>
        )}

        {status.type === 'success' && (
          <div className="uploader-success">
            <span className="uploader-check">✓</span>
            <p>{status.filename} · {status.chunks} {t('chunks')}</p>
          </div>
        )}

        {status.type === 'error' && (
          <div className="uploader-error">
            <p className="uploader-error-text">{status.message || 'Upload failed. Try again.'}</p>
            <button type="button" onClick={reset}>{t('retry')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
