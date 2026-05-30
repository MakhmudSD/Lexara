import { useState, useCallback } from 'react';
import '../styles/WorkspaceSelector.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function WorkspaceSelector({ workspaceId, onWorkspaceChange }) {
  const [raw, setRaw] = useState(workspaceId || '');
  const [touched, setTouched] = useState(false);

  const isValid = UUID_RE.test(raw.trim());
  const showError = touched && raw.trim() && !isValid;

  const commit = useCallback((val) => {
    const trimmed = val.trim();
    if (UUID_RE.test(trimmed)) {
      onWorkspaceChange(trimmed);
      localStorage.setItem('workspaceId', trimmed);
    } else {
      onWorkspaceChange('');
    }
  }, [onWorkspaceChange]);

  const handleChange = (e) => {
    const val = e.target.value;
    setRaw(val);
    if (UUID_RE.test(val.trim())) commit(val);
  };

  const handleBlur = () => {
    setTouched(true);
    commit(raw);
  };

  const handleGenerate = () => {
    const id = generateUUID();
    setRaw(id);
    setTouched(true);
    onWorkspaceChange(id);
    localStorage.setItem('workspaceId', id);
  };

  return (
    <div className="workspace-selector">
      <div className="workspace-input-wrap">
        <input
          type="text"
          className={`workspace-input ${isValid ? 'valid' : showError ? 'invalid' : ''}`}
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="xxxxxxxx-xxxx-4xxx-…"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {isValid && (
        <div className="workspace-status ok">✓ workspace active</div>
      )}
      {showError && (
        <div className="workspace-status err">✗ invalid uuid format</div>
      )}
      {!raw && (
        <div className="workspace-status hint">paste a uuid or generate one</div>
      )}

      <button className="new-workspace-btn" onClick={handleGenerate}>
        + Generate workspace
      </button>
    </div>
  );
}
