import React, { useState, useEffect } from 'react';
import { 
  User, 
  Palette, 
  Cpu, 
  ShieldCheck, 
  Bell, 
  ChevronRight, 
  ArrowLeft,
  Check,
  Download,
  Sparkles
} from 'lucide-react';
import { CURRENT_USER } from '../../data/mockData';
import type { UserSession } from '../../services/api';
import { 
  SettingsSection, 
  SettingRow, 
  ToggleSwitch, 
  CustomSelect 
} from './SettingsComponents';
import './SettingsView.css';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  showToast: (msg: string) => void;
  user?: UserSession;
  onUpdateUser?: (updated: { name?: string; theme?: string }) => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

type SettingsSectionType = 'account' | 'appearance' | 'ai' | 'privacy' | 'notifications';

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  onToggleTheme,
  showToast,
  user,
  onUpdateUser,
  onOpenAuth,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionType>('account');
  const [mobileDrilldownOpen, setMobileDrilldownOpen] = useState(false);

  // Form states
  const [name, setName] = useState(user?.name || CURRENT_USER.name);
  const [email, setEmail] = useState(user?.email || CURRENT_USER.email);
  const [aiModel, setAiModel] = useState('Claude 3.5 Sonnet / Gemini 1.5 Pro Hybrid');
  const [autoIndexDocs, setAutoIndexDocs] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Sync state if user prop changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const sections = [
    { id: 'account' as SettingsSectionType, label: 'Account Profile', icon: <User size={16} />, desc: 'Personal details and email preferences' },
    { id: 'appearance' as SettingsSectionType, label: 'Appearance', icon: <Palette size={16} />, desc: 'Interface theme and density controls' },
    { id: 'ai' as SettingsSectionType, label: 'AI & Indexing', icon: <Cpu size={16} />, desc: 'Workspace models, vector chunks, and privacy' },
    { id: 'privacy' as SettingsSectionType, label: 'Data & Security', icon: <ShieldCheck size={16} />, desc: 'Tenant isolation and export archives' },
    { id: 'notifications' as SettingsSectionType, label: 'Notifications', icon: <Bell size={16} />, desc: 'Alert badges and task due reminders' },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser({ name });
    }
    showToast('Settings saved successfully');
  };

  const renderContentPanel = () => {
    switch (activeSection) {
      case 'account':
        return (
          <SettingsSection
            asForm
            onSubmit={handleSave}
            title="Account Profile"
            description="Manage your identity, personal workspace details, and email notifications."
          >
            <div className="settings-rows-group">
              <div className="settings-user-hero">
                <div className="settings-large-avatar">{CURRENT_USER.avatar}</div>
                <div>
                  <span className="settings-user-hero-name">{name}</span>
                  <span className="settings-user-hero-role">{CURRENT_USER.role}</span>
                </div>
              </div>

              <div className="settings-field-group">
                <label htmlFor="settings-name" className="settings-field-label">Full Name</label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="settings-text-input"
                  autoComplete="name"
                />
              </div>

              <div className="settings-field-group">
                <label htmlFor="settings-email" className="settings-field-label">Email Address</label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby="settings-email-hint"
                  className="settings-text-input"
                  autoComplete="email"
                />
                <span id="settings-email-hint" className="field-hint">
                  Used for security alerts and daily focus briefings.
                </span>
              </div>

              <div className="settings-field-group">
                <label htmlFor="settings-subdomain" className="settings-field-label">Workspace Subdomain</label>
                <input
                  id="settings-subdomain"
                  type="text"
                  value="nabin-engineering.myspace.ai"
                  disabled
                  className="settings-text-input input-disabled"
                />
              </div>
            </div>

            <div className="settings-actions-footer">
              <button type="submit" className="settings-btn settings-btn-primary">
                Save Account Changes
              </button>
              {onOpenAuth && (
                <button type="button" className="settings-btn settings-btn-secondary" onClick={onOpenAuth}>
                  Switch Account
                </button>
              )}
              {onLogout && (
                <button type="button" className="settings-btn settings-btn-secondary settings-btn-danger" onClick={onLogout}>
                  Sign Out
                </button>
              )}
            </div>
          </SettingsSection>
        );

      case 'appearance':
        return (
          <SettingsSection
            title="Appearance & Theme"
            description="Choose between calibrated dark and light surface modes."
          >
            <div 
              className="theme-selection-grid"
              role="radiogroup" 
              aria-label="Theme selection"
            >
              <div 
                className={`theme-card ${theme === 'dark' ? 'active' : ''}`}
                role="radio"
                aria-checked={theme === 'dark'}
                tabIndex={0}
                onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (theme !== 'dark') onToggleTheme();
                  }
                }}
              >
                <div className="theme-preview dark-preview" aria-hidden="true">
                  <div className="preview-bar" />
                  <div className="preview-card" />
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-name-row">
                    <span className="theme-card-name">Obsidian Dark</span>
                    {theme === 'dark' && <span className="theme-active-pill">Active</span>}
                  </div>
                  <span className="theme-card-sub">Layered graphite surfaces</span>
                </div>
                {theme === 'dark' && (
                  <div className="theme-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                )}
              </div>

              <div 
                className={`theme-card ${theme === 'light' ? 'active' : ''}`}
                role="radio"
                aria-checked={theme === 'light'}
                tabIndex={0}
                onClick={() => { if (theme !== 'light') onToggleTheme(); }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (theme !== 'light') onToggleTheme();
                  }
                }}
              >
                <div className="theme-preview light-preview" aria-hidden="true">
                  <div className="preview-bar" />
                  <div className="preview-card" />
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-name-row">
                    <span className="theme-card-name">Clean Light</span>
                    {theme === 'light' && <span className="theme-active-pill">Active</span>}
                  </div>
                  <span className="theme-card-sub">High contrast paper canvas</span>
                </div>
                {theme === 'light' && (
                  <div className="theme-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={2.5} />
                  </div>
                )}
              </div>
            </div>
          </SettingsSection>
        );

      case 'ai':
        return (
          <SettingsSection
            asForm
            onSubmit={handleSave}
            title="AI Workspace Intelligence"
            description="Configure local vector embeddings and autonomous workspace context."
          >
            <div className="settings-rows-group">
              <SettingRow
                layout="stacked"
                htmlFor="reasoning-engine-select"
                title="Reasoning Engine"
                description="Select the primary inference engine powering workspace synthesis and answers."
              >
                <CustomSelect
                  id="reasoning-engine-select"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  ariaDescribedBy="reasoning-engine-select-desc"
                >
                  <option value="Claude 3.5 Sonnet / Gemini 1.5 Pro Hybrid">Hybrid Engine (High Precision)</option>
                  <option value="Local-First Llama 3 8B">Local-First (Offline Privacy)</option>
                  <option value="Fast Latency Turbo">Low-Latency Fast Streamer</option>
                </CustomSelect>
              </SettingRow>

              <SettingRow
                htmlFor="auto-index-switch"
                title="Automatic Document Indexing"
                description="Automatically embed notes and PDFs for instant universal semantic search."
                control={
                  <ToggleSwitch
                    id="auto-index-switch"
                    checked={autoIndexDocs}
                    onChange={setAutoIndexDocs}
                    ariaDescribedBy="auto-index-switch-desc"
                  />
                }
              />
            </div>

            <div className="settings-actions-footer">
              <button type="submit" className="settings-btn settings-btn-primary">
                <Sparkles size={16} aria-hidden="true" />
                Update AI Engine
              </button>
            </div>
          </SettingsSection>
        );

      case 'privacy':
        return (
          <SettingsSection
            title="Data Privacy & Isolation"
            description="Enterprise-grade multi-tenant boundaries and local encryption keys."
          >
            <div className="settings-rows-group">
              {/* Tenant Boundary Status Card */}
              <div className="settings-status-card">
                <div className="settings-status-icon-wrap" aria-hidden="true">
                  <ShieldCheck size={22} className="settings-status-icon" />
                </div>
                <div className="settings-status-content">
                  <div className="settings-status-header">
                    <span className="settings-status-title">Tenant Boundary Status</span>
                    <span className="badge badge-success settings-status-badge">Enforced</span>
                  </div>
                  <p className="settings-status-desc">
                    All documents are encrypted with your workspace master token. No user notes or code snippets are shared with external model training pipelines.
                  </p>
                </div>
              </div>

              {/* Export Workspace Archive Row */}
              <SettingRow
                title="Export workspace archive"
                description="Download all notes, tasks and documents as a .zip"
                control={
                  <button 
                    type="button" 
                    className="settings-btn settings-btn-secondary"
                    onClick={() => showToast('Data export initiated. Check your email shortly.')}
                  >
                    <Download size={16} aria-hidden="true" />
                    Export Archive (.zip)
                  </button>
                }
              />
            </div>
          </SettingsSection>
        );

      case 'notifications':
        return (
          <SettingsSection
            asForm
            onSubmit={handleSave}
            title="Workspace Notifications"
            description="Configure task due notifications and AI synthesis digests."
          >
            <div className="settings-rows-group">
              <SettingRow
                htmlFor="email-reminders-switch"
                title="Email Task Reminders"
                description="Receive a digest at 8:00 AM each morning for tasks scheduled today."
                control={
                  <ToggleSwitch
                    id="email-reminders-switch"
                    checked={emailNotifications}
                    onChange={setEmailNotifications}
                    ariaDescribedBy="email-reminders-switch-desc"
                  />
                }
              />
            </div>

            <div className="settings-actions-footer">
              <button type="submit" className="settings-btn settings-btn-primary">
                Save Preferences
              </button>
            </div>
          </SettingsSection>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-view-container">
      {/* Desktop Layout: 2-Column Left Nav + Right Content */}
      <div className="settings-desktop-layout">
        <aside className="settings-nav-sidebar">
          <h1 className="settings-main-heading">Settings</h1>
          <nav className="settings-nav-list" aria-label="Settings navigation">
            {sections.map((sec) => (
              <button
                key={sec.id}
                className={`settings-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
                aria-current={activeSection === sec.id ? 'page' : undefined}
              >
                <div className="settings-nav-icon">{sec.icon}</div>
                <span className="settings-nav-label">{sec.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-content-panel">
          {renderContentPanel()}
        </main>
      </div>

      {/* Mobile Layout: Stacked sections with drilldown view */}
      <div className="settings-mobile-layout">
        {!mobileDrilldownOpen ? (
          <div className="settings-mobile-menu">
            <h1 className="settings-main-heading">Settings</h1>
            <div className="settings-mobile-list" role="navigation" aria-label="Settings mobile navigation">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  className="settings-mobile-item"
                  onClick={() => {
                    setActiveSection(sec.id);
                    setMobileDrilldownOpen(true);
                  }}
                >
                  <div className="mobile-item-left">
                    <div className="settings-nav-icon">{sec.icon}</div>
                    <div className="mobile-item-text">
                      <span className="mobile-item-title">{sec.label}</span>
                      <span className="mobile-item-desc">{sec.desc}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="mobile-item-arrow" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="settings-mobile-drilldown">
            <div className="drilldown-header">
              <button 
                className="btn-icon drilldown-back-btn" 
                onClick={() => setMobileDrilldownOpen(false)}
                aria-label="Back to settings list"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="drilldown-title">
                {sections.find(s => s.id === activeSection)?.label}
              </h2>
            </div>
            <div className="drilldown-body">
              {renderContentPanel()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
