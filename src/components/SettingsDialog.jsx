import { useState, useEffect, useCallback } from "react";
import {
  getStorageMode,
  saveStorageMode,
  getTursoConfig,
  saveTursoConfig,
  testTursoConnection,
  migrateLocalToTurso,
  migrateTursoToLocal,
} from "../store/storageMiddleware";

/**
 * SettingsDialog
 *
 * Shows what storage is currently active, then lets the user edit and switch.
 * Changes only take effect after "Save & Reload".
 */
export default function SettingsDialog({ onClose }) {
  // What is actually saved and active right now (read once on open)
  const savedMode = getStorageMode();
  const savedConfig = getTursoConfig();

  // Draft state — what the user is editing
  const [mode, setMode] = useState(savedMode);
  const [url, setUrl] = useState(savedConfig.url);
  const [token, setToken] = useState(savedConfig.token);
  const [showToken, setShowToken] = useState(false);
  const [editing, setEditing] = useState(false); // collapsed by default if already configured

  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [testError, setTestError] = useState("");

  const [migrateStatus, setMigrateStatus] = useState(null); // null | 'running' | 'ok' | 'error'
  const [migrateMsg, setMigrateMsg] = useState("");

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleTest = useCallback(async () => {
    if (!url || !token) {
      setTestStatus("error");
      setTestError("Please enter both the database URL and auth token.");
      return;
    }
    setTestStatus("testing");
    setTestError("");
    const result = await testTursoConnection(url, token);
    if (result.ok) {
      setTestStatus("ok");
    } else {
      setTestStatus("error");
      setTestError(result.error || "Connection failed.");
    }
  }, [url, token]);

  const handleSave = useCallback(() => {
    saveTursoConfig(url, token);
    saveStorageMode(mode);
    window.location.reload();
  }, [mode, url, token]);

  const handleCancelEdit = useCallback(() => {
    // Revert draft to saved values
    setMode(savedMode);
    setUrl(savedConfig.url);
    setToken(savedConfig.token);
    setTestStatus(null);
    setEditing(false);
  }, [savedMode, savedConfig.url, savedConfig.token]);

  const handleMigrateToTurso = useCallback(async () => {
    setMigrateStatus("running");
    setMigrateMsg("");
    try {
      saveTursoConfig(url, token);
      const count = await migrateLocalToTurso();
      setMigrateStatus("ok");
      setMigrateMsg(
        `Done! ${count} record${count !== 1 ? "s" : ""} pushed to Turso.`,
      );
    } catch (err) {
      setMigrateStatus("error");
      setMigrateMsg(err.message);
    }
  }, [url, token]);

  const handleMigrateToLocal = useCallback(async () => {
    setMigrateStatus("running");
    setMigrateMsg("");
    try {
      saveTursoConfig(url, token);
      await migrateTursoToLocal();
      setMigrateStatus("ok");
      setMigrateMsg("Done! Turso data pulled into local storage.");
    } catch (err) {
      setMigrateStatus("error");
      setMigrateMsg(err.message);
    }
  }, [url, token]);

  // Has the user made any unsaved changes?
  const isDirty =
    mode !== savedMode || url !== savedConfig.url || token !== savedConfig.token;

  // Migration requires creds to be present in the draft fields
  const tursoConfigured = url.trim() && token.trim();

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">&#x2699;&#xFE0F; Settings</h2>
          <button
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* ── Active storage status card ── */}
        <section className="settings-section">
          <h3 className="settings-section-title">Active Storage</h3>
          <div className="settings-active-card">
            <div className="settings-active-info">
              <span className="settings-active-icon">
                {savedMode === "turso" ? "☁️" : "💻"}
              </span>
              <div className="settings-active-text">
                <span className="settings-active-label">
                  {savedMode === "turso" ? "Turso DB" : "Local Storage"}
                </span>
                {savedMode === "turso" && savedConfig.url && (
                  <span className="settings-active-sub">
                    {savedConfig.url}
                  </span>
                )}
                {savedMode === "local" && (
                  <span className="settings-active-sub">
                    Data stored on this device only
                  </span>
                )}
              </div>
              <span className="settings-active-badge">Active</span>
            </div>
            {!editing && (
              <button
                className="settings-edit-btn"
                onClick={() => setEditing(true)}
              >
                &#x270E; Edit
              </button>
            )}
          </div>
        </section>

        {/* ── Edit form — only shown when editing ── */}
        {editing && (
          <>
            <section className="settings-section">
              <h3 className="settings-section-title">Change Storage Mode</h3>
              <p className="settings-section-desc">
                Select where to save your progress, bookmarks, and practice
                answers. Changes apply after Save &amp; Reload.
              </p>
              <div className="settings-mode-toggle">
                <button
                  className={`settings-mode-btn ${mode === "local" ? "settings-mode-btn--active" : ""}`}
                  onClick={() => setMode("local")}
                >
                  <span className="settings-mode-icon">&#x1F4BB;</span>
                  <span className="settings-mode-label">Local Storage</span>
                  <span className="settings-mode-sub">This device only</span>
                </button>
                <button
                  className={`settings-mode-btn ${mode === "turso" ? "settings-mode-btn--active" : ""}`}
                  onClick={() => setMode("turso")}
                >
                  <span className="settings-mode-icon">&#x2601;&#xFE0F;</span>
                  <span className="settings-mode-label">Turso DB</span>
                  <span className="settings-mode-sub">Synced across devices</span>
                </button>
              </div>
            </section>

            {/* Turso credentials — only when Turso mode is being selected */}
            {mode === "turso" && (
              <section className="settings-section">
                <h3 className="settings-section-title">Turso Configuration</h3>
                <p className="settings-section-desc">
                  Credentials are stored only on this device (in localStorage).
                </p>

                <div className="settings-field">
                  <label className="settings-label" htmlFor="turso-url">
                    Database URL
                  </label>
                  <input
                    id="turso-url"
                    className="settings-input"
                    type="url"
                    placeholder="libsql://your-db-name.turso.io"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setTestStatus(null);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="settings-field">
                  <label className="settings-label" htmlFor="turso-token">
                    Auth Token
                  </label>
                  <div className="settings-input-wrap">
                    <input
                      id="turso-token"
                      className="settings-input"
                      type={showToken ? "text" : "password"}
                      placeholder="eyJ..."
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value);
                        setTestStatus(null);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      className="settings-reveal-btn"
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="settings-test-row">
                  <button
                    className="settings-test-btn"
                    onClick={handleTest}
                    disabled={testStatus === "testing" || !url || !token}
                  >
                    {testStatus === "testing" ? "Testing..." : "Test Connection"}
                  </button>
                  {testStatus === "ok" && (
                    <span className="settings-status settings-status--ok">
                      &#x2705; Connected
                    </span>
                  )}
                  {testStatus === "error" && (
                    <span className="settings-status settings-status--error">
                      &#x274C; {testError}
                    </span>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Data migration — visible whenever Turso creds are present ── */}
        {tursoConfigured && (
          <section className="settings-section">
            <h3 className="settings-section-title">Data Migration</h3>
            <p className="settings-section-desc">
              Copy your progress, bookmarks, and QnA answers between backends.
              Safe to run multiple times — uses UPSERT.
            </p>
            <div className="settings-migrate-row">
              <button
                className="settings-migrate-btn"
                onClick={handleMigrateToTurso}
                disabled={migrateStatus === "running"}
              >
                &#x2191; Push local &rarr; Turso
              </button>
              <button
                className="settings-migrate-btn"
                onClick={handleMigrateToLocal}
                disabled={migrateStatus === "running"}
              >
                &#x2193; Pull Turso &rarr; local
              </button>
            </div>
            {migrateStatus === "running" && (
              <p className="settings-status settings-status--info">
                Migrating data...
              </p>
            )}
            {migrateStatus === "ok" && (
              <p className="settings-status settings-status--ok">
                &#x2705; {migrateMsg}
              </p>
            )}
            {migrateStatus === "error" && (
              <p className="settings-status settings-status--error">
                &#x274C; {migrateMsg}
              </p>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="settings-footer">
          {editing ? (
            <>
              <button className="settings-cancel-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button
                className="settings-save-btn"
                onClick={handleSave}
                disabled={!isDirty}
              >
                Save &amp; Reload
              </button>
            </>
          ) : (
            <button className="settings-cancel-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
