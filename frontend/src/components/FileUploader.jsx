import { useState, useRef } from 'react';
import { uploadDocument } from '../api/upload';
import '../styles/FileUploader.css';

export default function FileUploader({ workspaceId, onUploadSuccess, onUploadError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      const message = 'Only PDF, DOCX, and TXT files are supported';
      setUploadStatus(message);
      onUploadError?.(message);
      return;
    }

    setIsLoading(true);
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const result = await uploadDocument(file, workspaceId);
      setUploadStatus(`✓ ${file.name} uploaded (${result.chunk_count} chunks)`);
      onUploadSuccess?.(result);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Clear status after 3 seconds
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      const message = error.response?.data?.detail || 'Upload failed';
      setUploadStatus(`✗ ${message}`);
      onUploadError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-uploader">
      <label htmlFor="file-input" className="file-uploader-label">
        <span>📄 Upload Document</span>
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={handleFileSelect}
          disabled={isLoading}
          className="file-uploader-input"
        />
      </label>
      {uploadStatus && <p className={`upload-status ${isLoading ? 'loading' : ''}`}>{uploadStatus}</p>}
    </div>
  );
}
