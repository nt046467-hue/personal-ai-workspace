import React, { useState, useEffect, useCallback } from 'react';
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
  Sparkles,
  Key,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { CURRENT_USER } from '../../data/mockData';
import type { UserSession } from '../../services/api';
import { 
  SettingsSection, 
  SettingRow, 
  ToggleSwitch 
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
  // AI / BYOK state
  const [byokProvider, setByokProvider] = useState('gemini');
  const [byokBaseUrl, setByokBaseUrl] = useState('');
  const [byokModel, setByokModel] = useState('');
  const [byokKey, setByokKey] = useState('');
  const [byokKeyMasked, setByokKeyMasked] = useState<string | null>(null); // loaded from server
  const [byokShowKey, setByokShowKey] = useState(false);
  const [byokStatus, setByokStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [byokErrorMsg, setByokErrorMsg] = useState('');
  const [byokHasKey, setByokHasKey] = useState(false);
  const [byokDeleting, setByokDeleting] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
    gemini:    { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-flash' },
    openai:    { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    groq:      { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama3-70b-8192' },
    openrouter:{ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
    ollama:    { baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
    custom:    { baseUrl: '', model: '' },
  };

  // Load existing BYOK settings on mount
  const loadByokSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        if (d?.hasKey) {
          setByokHasKey(true);
          setByokKeyMasked(d.maskedKey || null);
          setByokProvider(d.provider || 'gemini');
          setByokBaseUrl(d.baseUrl || '');
          setByokModel(d.model || '');
        }
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { loadByokSettings(); }, [loadByokSettings]);

  // Sync state if user prop changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // When provider changes, fill in sensible defaults for URL + model
  const handleProviderChange = (p: string) => {
    setByokProvider(p);
    const defaults = PROVIDER_DEFAULTS[p] || { baseUrl: '', model: '' };
    setByokBaseUrl(defaults.baseUrl);
    setByokModel(defaults.model);
  };

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
            title="AI Provider"
            description="Connect your own API key (BYOK). Your key is stored encrypted and never logged. The operator provides a shared key with a daily usage cap."
          >
            {/* Current key status banner */}
            {byokHasKey && (
              <div className="byok-status-banner byok-status-active">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Active BYOK key connected</span>
                {byokKeyMasked && <code className="byok-masked-key">{byokKeyMasked}</code>}
              </div>
            )}
            {!byokHasKey && (
              <div className="byok-status-banner byok-status-none">
                <AlertCircle size={16} aria-hidden="true" />
                <span>Using shared operator key · <strong>{'{daily cap}'}</strong> requests/day</span>
              </div>
            )}

            <div className="settings-rows-group byok-form-grid">
              {/* Provider */}
              <div className="settings-field-group">
                <label htmlFor="byok-provider" className="settings-field-label">Provider</label>
                <select
                  id="byok-provider"
                  className="settings-text-input byok-select"
                  value={byokProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  <option value="gemini">Google Gemini (recommended)</option>
                  <option value="openai">OpenAI</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama (local)</option>
                  <option value="custom">Custom / Self-hosted</option>
                </select>
              </div>

              {/* API Key */}
              <div className="settings-field-group">
                <label htmlFor="byok-api-key" className="settings-field-label">
                  <Key size={13} aria-hidden="true" /> API Key
                </label>
                <div className="byok-key-input-wrap">
                  <input
                    id="byok-api-key"
                    type={byokShowKey ? 'text' : 'password'}
                    className="settings-text-input byok-key-input"
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    placeholder={byokHasKey ? '(leave blank to keep current key)' : 'sk-… / AIza…'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="byok-eye-btn"
                    aria-label={byokShowKey ? 'Hide key' : 'Show key'}
                    onClick={() => setByokShowKey((v) => !v)}
                  >
                    {byokShowKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div className="settings-field-group">
                <label htmlFor="byok-base-url" className="settings-field-label">Base URL</label>
                <input
                  id="byok-base-url"
                  type="url"
                  className="settings-text-input"
                  value={byokBaseUrl}
                  onChange={(e) => setByokBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              {/* Model */}
              <div className="settings-field-group">
                <label htmlFor="byok-model" className="settings-field-label">Model</label>
                <input
                  id="byok-model"
                  type="text"
                  className="settings-text-input"
                  value={byokModel}
                  onChange={(e) => setByokModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>

            {/* Feedback */}
            {byokStatus === 'error' && (
              <div className="byok-feedback byok-feedback-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {byokErrorMsg}
              </div>
            )}
            {byokStatus === 'success' && (
              <div className="byok-feedback byok-feedback-success" role="status">
                <CheckCircle2 size={14} aria-hidden="true" />
                Key verified and saved successfully.
              </div>
            )}

            <div className="settings-actions-footer byok-footer">
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                disabled={byokStatus === 'loading' || (!byokKey.trim() && !byokHasKey)}
                onClick={async () => {
                  if (!byokKey.trim() && byokHasKey) {
                    // Key not changed — save only provider/url/model? For simplicity: no-op unless key entered.
                    showToast('Enter a new API key to update settings.');
                    return;
                  }
                  setByokStatus('loading');
                  setByokErrorMsg('');
                  try {
                    const res = await fetch('/api/settings/ai', {
                      method: 'PUT',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        provider: byokProvider,
                        apiKey: byokKey.trim(),
                        baseUrl: byokBaseUrl.trim(),
                        model: byokModel.trim(),
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) {
                      setByokStatus('error');
                      setByokErrorMsg(json.error?.message || 'Failed to save key.');
                    } else {
                      setByokStatus('success');
                      setByokKey('');
                      setByokHasKey(true);
                      setByokKeyMasked(json.data?.maskedKey || null);
                      showToast('AI key saved and verified.');
                      setTimeout(() => setByokStatus('idle'), 3000);
                    }
                  } catch {
                    setByokStatus('error');
                    setByokErrorMsg('Network error. Please try again.');
                  }
                }}
              >
                {byokStatus === 'loading' ? (
                  <><Loader2 size={15} className="byok-spinner" aria-hidden="true" /> Verifying…</>
                ) : (
                  <><Sparkles size={15} aria-hidden="true" /> Save & Test Connection</>
                )}
              </button>

              {byokHasKey && (
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary settings-btn-danger"
                  disabled={byokDeleting}
                  onClick={async () => {
                    if (!confirm('Remove your BYOK key? The shared operator key will be used instead.')) return;
                    setByokDeleting(true);
                    try {
                      const res = await fetch('/api/settings/ai', { method: 'DELETE', credentials: 'include' });
                      if (res.ok) {
                        setByokHasKey(false);
                        setByokKeyMasked(null);
                        setByokKey('');
                        setByokStatus('idle');
                        showToast('BYOK key removed. Using shared operator key.');
                      } else {
                        showToast('Failed to remove key. Please try again.');
                      }
                    } catch {
                      showToast('Network error.');
                    } finally {
                      setByokDeleting(false);
                    }
                  }}
                >
                  {byokDeleting ? (
                    <Loader2 size={15} className="byok-spinner" aria-hidden="true" />
                  ) : (
                    <Trash2 size={15} aria-hidden="true" />
                  )}
                  Remove Key
                </button>
              )}
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
