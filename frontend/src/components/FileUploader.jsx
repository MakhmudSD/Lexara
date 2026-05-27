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
  const phaseTimerRef = useRef(null);
  const isAllowedFile = (file) => ALLOWED[file.type] || file.name.match(/\.(pdf|docx|txt)$/i);

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const reset = () => {
    clearDismissTimer();
    clearPhaseTimer();
    setStatus({ type: 'idle' });
    setDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (status.type === 'uploading' || disabled || !workspaceId) return;
    if (!isAllowedFile(file)) {
      const message = t('upload_failed_retry');
      setStatus({ type: 'error', message });
      onUploadError?.(message);
      return;
    }

    clearDismissTimer();
    clearPhaseTimer();
    setDragging(false);
    setStatus({ type: 'uploading', filename: file.name });

    try {
      const result = await uploadDocument(file, workspaceId);
      setStatus({ type: 'success', filename: file.name, phase: 'indexing' });
      onUploadSuccess?.(result);
      if (inputRef.current) inputRef.current.value = '';
      phaseTimerRef.current = window.setTimeout(() => {
        setStatus((current) => (
          current.type === 'success'
            ? { ...current, phase: 'ready' }
            : current
        ));
      }, 3000);
    } catch (err) {
      const msg = t('upload_failed_retry');
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

  useEffect(() => () => {
    clearDismissTimer();
    clearPhaseTimer();
  }, []);

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
            <p className="uploader-status">{t('processing')}</p>
          </div>
        )}

        {status.type === 'success' && (
          <div className="uploader-success">
            <span className="uploader-check">✓</span>
            <p>{status.filename} · {status.phase === 'ready' ? t('ready_to_query') : t('indexing_background')}</p>
          </div>
        )}

        {status.type === 'error' && (
          <div className="uploader-error">
            <p className="uploader-error-text">{status.message || t('upload_failed_retry')}</p>
            <button type="button" onClick={reset}>{t('retry')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
