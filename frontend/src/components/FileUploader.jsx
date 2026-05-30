import { useState, useRef } from 'react';
import { uploadDocument } from '../api/upload';
import '../styles/FileUploader.css';

const ALLOWED = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};

export default function FileUploader({ workspaceId, onUploadSuccess, onUploadError }) {
  const [status, setStatus] = useState(null); // { type: 'loading'|'success'|'error', text }
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (!ALLOWED[file.type] && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      const msg = 'Only PDF, DOCX, and TXT are supported';
      setStatus({ type: 'error', text: msg });
      onUploadError?.(msg);
      return;
    }

    setStatus({ type: 'loading', text: `uploading ${file.name}…` });

    try {
      const result = await uploadDocument(file, workspaceId);
      const chunks = result.chunk_count ?? result.chunks ?? '?';
      setStatus({ type: 'success', text: `indexed — ${chunks} chunks` });
      setUploads(prev => [{ name: file.name, chunks }, ...prev].slice(0, 5));
      onUploadSuccess?.(result);
      setTimeout(() => setStatus(null), 3000);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || err.message
        || 'Upload failed';
      setStatus({ type: 'error', text: msg });
      onUploadError?.(msg);
    }
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="file-uploader">
      <div
        className={`upload-drop-zone ${dragging ? 'dragging' : ''} ${status?.type === 'loading' ? 'loading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="upload-file-input"
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleInputChange}
          disabled={status?.type === 'loading' || !workspaceId}
        />
        <span className="upload-icon">↑</span>
        <div className="upload-label-text">
          {workspaceId ? 'Drop file or click' : 'Select workspace first'}
        </div>
        <span className="upload-accepted">pdf · docx · txt</span>
      </div>

      {status && (
        <div className={`upload-status ${status.type}`}>
          {status.type === 'loading' && <span className="upload-spinner" />}
          {status.type === 'success' && '✓'}
          {status.type === 'error' && '✗'}
          <span>{status.text}</span>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="recent-uploads">
          {uploads.map((u, i) => (
            <div key={i} className="recent-upload-item">
              <span className="recent-upload-name" title={u.name}>{u.name}</span>
              <span className="recent-upload-chunks">{u.chunks}c</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
