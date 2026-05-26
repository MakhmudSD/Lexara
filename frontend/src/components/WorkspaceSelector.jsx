import { useEffect, useState } from 'react';
import { quickCreateWorkspace, updateWorkspaceName } from '../api/workspace';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/WorkspaceSelector.css';

const NAME_RE = /^[^\x00-\x1F\x7F<>:"\/\\|?*]{1,40}$/;

export default function WorkspaceSelector({
  workspaceId,
  workspaceName,
  onWorkspaceChange,
  onWorkspaceNameChange,
}) {
  const { t } = useTranslation();
  const [nameInput, setNameInput] = useState(workspaceName || '');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    setNameInput(workspaceName || '');
  }, [workspaceName]);

  const shortWorkspaceId = workspaceId ? `${workspaceId.slice(0, 8)}…` : '';
  const nameError = (() => {
    if (!nameInput) return null;
    if (nameInput.trim().length < 2) return t('name_too_short');
    if (nameInput.trim().length > 40) return t('name_too_long');
    if (!NAME_RE.test(nameInput.trim())) return t('name_invalid_chars');
    return null;
  })();

  const persistName = async () => {
    const normalized = nameInput.trim();
    if (!workspaceId) return;
    if (!normalized) return;
    if (nameError) {
      setSaveStatus(`✗ ${nameError}`);
      return;
    }

    try {
      const workspace = await updateWorkspaceName(workspaceId, normalized);
      setNameInput(workspace.name);
      onWorkspaceNameChange(workspace.name);
      localStorage.setItem('workspaceName', workspace.name);
      setSaveStatus(t('workspace_saved'));
    } catch (err) {
      const msg = err.response?.data?.error?.message || t('workspace_save_failed');
      setSaveStatus(`✗ ${t('workspace_save_failed')}: ${msg}`);
    }
  };

  const handleGenerate = async () => {
    setCreating(true);
    setCreateError('');
    setSaveStatus('');
    try {
      const workspace = await quickCreateWorkspace('My Workspace');
      setNameInput(workspace.name);
      onWorkspaceChange(workspace.id);
      onWorkspaceNameChange(workspace.name);
      localStorage.setItem('workspaceId', workspace.id);
      localStorage.setItem('workspaceName', workspace.name);
      setSaveStatus(t('workspace_saved'));
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || t('create_workspace_failed');
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="workspace-selector">
      <div className="workspace-input-wrap">
        <input
          type="text"
          className="workspace-input"
          value={nameInput}
          onChange={(event) => {
            setNameInput(event.target.value);
            setSaveStatus('');
            setCreateError('');
          }}
          onBlur={persistName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              persistName();
            }
          }}
          placeholder={t('workspace_name_placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        {nameInput && <div className="workspace-name-display">{nameInput}</div>}
        {workspaceId && <div className="workspace-uuid-hint">{t('workspace_id_hint')}{shortWorkspaceId}</div>}
      </div>

      {nameError && <div className="workspace-status err">✗ {nameError}</div>}
      {!!saveStatus && <div className={`workspace-status ${saveStatus.startsWith('✓') ? 'ok' : 'err'}`}>{saveStatus}</div>}
      {createError && <div className="workspace-status err">✗ {createError}</div>}
      {!workspaceId && !createError && <div className="workspace-status hint">{t('paste_uuid_or_generate')}</div>}

      <button className="new-workspace-btn" onClick={handleGenerate} disabled={creating}>
        {creating ? t('creating_workspace') : `+ ${t('generate_workspace')}`}
      </button>
    </div>
  );
}
