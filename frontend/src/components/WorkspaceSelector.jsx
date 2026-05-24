import '../styles/WorkspaceSelector.css';

export default function WorkspaceSelector({ workspaceId, onWorkspaceChange, onStartChat }) {
  return (
    <div className="workspace-selector">
      <h2>💼 Workspace</h2>
      <input
        type="text"
        value={workspaceId}
        onChange={(e) => onWorkspaceChange(e.target.value)}
        placeholder="Enter workspace ID"
        className="workspace-input"
      />
      <button onClick={onStartChat} disabled={!workspaceId.trim()} className="start-chat-btn">
        Start Chat
      </button>
    </div>
  );
}
