import React, { useState, useEffect } from 'react';
import { X, Mail, Globe, Save, LogOut, User } from 'lucide-react';
import type { UserSession } from '../../services/api';
import { api } from '../../services/api';
import './ProfileView.css';

interface ProfileViewProps {
  user?: UserSession;
  onBack: () => void;
  onUpdateUser?: (updated: { name?: string; theme?: string }) => void;
  onLogout?: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  taskCount?: number;
  knowledgeCount?: number;
  projectCount?: number;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onBack,
  onUpdateUser,
  onLogout,
  showToast,
  taskCount = 0,
  knowledgeCount = 0,
  projectCount = 0,
}) => {
  const [name, setName]   = useState(user?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync when user prop changes (e.g. after login)
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  // Dismiss on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Derive a readable workspace subdomain from workspaceName
  const subdomain = user?.workspaceName
    ? user.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/, '') + '.myspace.ai'
    : 'workspace.myspace.ai';

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await api.updateProfile({ name: name.trim() });
      onUpdateUser?.({ name: name.trim() });
      showToast('Profile updated', 'success');
    } catch {
      showToast('Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onBack();
    }
  };

  return (
    <div 
      className="profile-overlay" 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-card-title"
    >
      <div className="profile-card" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="profile-card-header">
          <h2 id="profile-card-title" className="profile-card-title">Account Profile</h2>
          <button className="profile-close-btn" onClick={onBack} aria-label="Close Profile">
            <X size={18} />
          </button>
        </div>

        {/* ── Sub-heading ── */}
        <p className="profile-card-subtitle">
          Manage your identity, personal workspace details, and email notifications.
        </p>

        {/* ── Avatar Hero ── */}
        <div className="profile-avatar-section">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-avatar-meta">
            <span className="profile-avatar-name">{user?.name ?? '—'}</span>
            <span className="profile-avatar-email">{user?.email ?? '—'}</span>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="profile-stats-bar">
          <div className="profile-stat">
            <span className="profile-stat-val">{taskCount}</span>
            <span className="profile-stat-lbl">Tasks</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-val">{knowledgeCount}</span>
            <span className="profile-stat-lbl">Knowledge</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-val">{projectCount}</span>
            <span className="profile-stat-lbl">Projects</span>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="profile-form">
          {/* Full Name — editable */}
          <div className="profile-field-group">
            <label htmlFor="pf-name" className="profile-field-label">
              <User size={13} />
              Full Name
            </label>
            <input
              id="pf-name"
              type="text"
              className="profile-field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
          </div>

          {/* Email — read-only (auth-managed) */}
          <div className="profile-field-group">
            <label htmlFor="pf-email" className="profile-field-label">
              <Mail size={13} />
              Email Address
            </label>
            <input
              id="pf-email"
              type="email"
              className="profile-field-input profile-field-readonly"
              value={user?.email ?? ''}
              readOnly
              aria-describedby="pf-email-hint"
            />
            <span id="pf-email-hint" className="profile-field-hint">
              Used for security alerts and daily focus briefings.
            </span>
          </div>

          {/* Workspace Subdomain — read-only */}
          <div className="profile-field-group">
            <label htmlFor="pf-subdomain" className="profile-field-label">
              <Globe size={13} />
              Workspace Subdomain
            </label>
            <input
              id="pf-subdomain"
              type="text"
              className="profile-field-input profile-field-readonly"
              value={subdomain}
              readOnly
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="profile-card-footer">
          {onLogout && (
            <button
              className="profile-btn profile-btn-danger"
              onClick={async () => { await onLogout(); }}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          )}
          <div className="profile-footer-right">
            <button className="profile-btn profile-btn-cancel" onClick={onBack}>
              Cancel
            </button>
            <button
              className="profile-btn profile-btn-save"
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
            >
              <Save size={15} />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
