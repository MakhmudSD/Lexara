import client from './client';

/**
 * Upload a document to a workspace.
 * @param {File} file - The file object from the file input or drop zone.
 * @param {string} workspaceId - Must be set before calling. UUID string.
 * @param {string|null} userId - Optional user identifier.
 * @param {function|null} onProgress - Optional (percent: number) => void callback.
 * @returns {Promise<object>} Upload response from the backend.
 */
export const uploadDocument = async (
  file,
  workspaceId,
  userId = null,
  onProgress = null,
) => {
  if (!workspaceId || workspaceId.trim() === '') {
    throw new Error('A workspace must be selected before uploading a document.');
  }
  if (!file) {
    throw new Error('No file provided.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('workspace_id', workspaceId.trim());
  if (userId) {
    formData.append('user_id', userId.trim());
  }

  const config = {};
  if (onProgress) {
    config.onUploadProgress = (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };
  }

  const response = await client.post('/documents/upload', formData, config);
  return response.data;
};

/**
 * Delete a document and its chunks from a workspace.
 * @param {string} documentId - UUID of the document to delete.
 * @returns {Promise<void>}
 */
export async function deleteDocument(documentId) {
  await client.delete(`/documents/${documentId}`);
}

/**
 * Fetch the processing status of a document.
 * @param {string} documentId - UUID of the document returned by uploadDocument.
 * @returns {Promise<{id: string, filename: string, status: string, chunk_count: number|null, error_message: string|null}>}
 */
export async function getDocumentStatus(documentId) {
  const token = localStorage.getItem('lexara_token');
  const response = await client.get(`/documents/${documentId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
