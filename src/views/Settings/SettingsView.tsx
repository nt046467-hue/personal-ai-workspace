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
  Loader2,
  ExternalLink,
  Sliders,
  Database,
  FileText,
  CheckSquare,
  Bookmark,
  FolderKanban
} from 'lucide-react';
import { CURRENT_USER } from '../../data/mockData';
import { api, type UserSession } from '../../services/api';
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

interface ProviderPreset {
  name: string;
  badge?: string;
  keyUrl?: string;
  keyLabel?: string;
  keyPlaceholder: string;
  baseUrl: string;
  models: { id: string; label: string; tag?: string }[];
}

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  gemini: {
    name: 'Google Gemini',
    badge: 'Recommended · Free Tier Available',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'Get Gemini Key',
    keyPlaceholder: 'AIzaSy...',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast & High Quality)', tag: 'Recommended' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Reasoning & Analysis)', tag: 'Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Next-Gen Preview)', tag: 'Preview' },
    ],
  },
  groq: {
    name: 'Groq Cloud',
    badge: 'Ultra-Fast Inference (280+ T/s)',
    keyUrl: 'https://console.groq.com/keys',
    keyLabel: 'Get Groq Key',
    keyPlaceholder: 'gsk_...',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Top Intelligence)', tag: 'Recommended' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Blazing Fast)', tag: 'Fastest' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Large 32k Context)', tag: 'Balanced' },
    ],
  },
  openai: {
    name: 'OpenAI',
    badge: 'GPT-4o & o-Series',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'Get OpenAI Key',
    keyPlaceholder: 'sk-proj-... / sk-...',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (Fast & Low Cost)', tag: 'Recommended' },
      { id: 'gpt-4o', label: 'GPT-4o (Flagship Omni Model)', tag: 'Flagship' },
      { id: 'o3-mini', label: 'o3-mini (High Precision Reasoning)', tag: 'Reasoning' },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    badge: 'Multi-Model Unified Gateway',
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'Get OpenRouter Key',
    keyPlaceholder: 'sk-or-...',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (State of the Art)', tag: 'Pro' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct', tag: 'Fast' },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free Route)', tag: 'Free' },
    ],
  },
  ollama: {
    name: 'Ollama (Local Offline)',
    badge: 'Private Self-Hosted',
    keyUrl: 'https://ollama.com',
    keyLabel: 'Download Ollama',
    keyPlaceholder: 'Optional (leave blank or enter "ollama")',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3', label: 'Llama 3 (8B)', tag: 'Local' },
      { id: 'mistral', label: 'Mistral (7B)', tag: 'Local' },
      { id: 'deepseek-r1:8b', label: 'DeepSeek R1 (8B)', tag: 'Local' },
      { id: 'qwen2.5', label: 'Qwen 2.5 (7B)', tag: 'Local' },
    ],
  },
  custom: {
    name: 'Custom OpenAI-Compatible API',
    badge: 'Custom Gateway / Proxy',
    keyPlaceholder: 'API Key or Bearer Token',
    baseUrl: '',
    models: [],
  },
};

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
  const [customModelMode, setCustomModelMode] = useState(false);
  const [byokKey, setByokKey] = useState('');
  const [byokKeyMasked, setByokKeyMasked] = useState<string | null>(null);
  const [byokShowKey, setByokShowKey] = useState(false);
  const [byokStatus, setByokStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [byokErrorMsg, setByokErrorMsg] = useState('');
  const [byokLatency, setByokLatency] = useState<number | null>(null);
  const [byokHasKey, setByokHasKey] = useState(false);
  const [byokDeleting, setByokDeleting] = useState(false);
  const [operatorConfigured, setOperatorConfigured] = useState(false);
  const [dailyCap, setDailyCap] = useState(500);
  const [showAdvancedUrl, setShowAdvancedUrl] = useState(false);
  const [indexStats, setIndexStats] = useState({ notes: 0, tasks: 0, bookmarks: 0, projects: 0 });
  const [exportingData, setExportingData] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Load existing BYOK settings on mount
  const loadByokSettings = useCallback(async () => {
    try {
      const d = await api.getAISettings();
      if (d) {
        if (d.hasCustomKey) {
          setByokHasKey(true);
          setByokKeyMasked(d.maskedKey || null);
          const p = d.provider || 'gemini';
          setByokProvider(p);
          setByokBaseUrl(d.baseUrl || '');
          const m = d.model || '';
          setByokModel(m);
          const presetModels = PROVIDER_PRESETS[p]?.models.map((x) => x.id) || [];
          if (m && !presetModels.includes(m)) {
            setCustomModelMode(true);
          } else {
            setCustomModelMode(false);
          }
        } else {
          setByokHasKey(false);
          setByokKeyMasked(null);
          const def = PROVIDER_PRESETS.gemini;
          setByokBaseUrl(def.baseUrl);
          setByokModel(def.models[0]?.id || 'gemini-1.5-flash');
          setCustomModelMode(false);
        }
        if (d.dailyCap) setDailyCap(d.dailyCap);
        if (typeof d.operatorConfigured === 'boolean') setOperatorConfigured(d.operatorConfigured);
        if (d.indexStats) setIndexStats(d.indexStats);
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
    const preset = PROVIDER_PRESETS[p] || PROVIDER_PRESETS.gemini;
    setByokBaseUrl(preset.baseUrl);
    const firstModel = preset.models[0]?.id || '';
    setByokModel(firstModel);
    setCustomModelMode(preset.models.length === 0);
    setByokStatus('idle');
    setByokErrorMsg('');
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

  const handleExportArchive = async () => {
    setExportingData(true);
    try {
      const [tasks, knowledge, bookmarks, projects] = await Promise.all([
        api.getTasks().catch(() => []),
        api.getKnowledge().catch(() => []),
        api.getBookmarks().catch(() => []),
        api.getProjects().catch(() => []),
      ]);

      const archive = {
        exportedAt: new Date().toISOString(),
        workspace: user?.workspaceName || 'MySpace Workspace',
        user: { name, email },
        summary: {
          taskCount: Array.isArray(tasks) ? tasks.length : 0,
          knowledgeCount: Array.isArray(knowledge) ? knowledge.length : 0,
          bookmarkCount: Array.isArray(bookmarks) ? bookmarks.length : 0,
          projectCount: Array.isArray(projects) ? projects.length : 0,
        },
        data: {
          tasks,
          knowledge,
          bookmarks,
          projects,
        },
      };

      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Workspace backup downloaded successfully!');
    } catch (err: any) {
      showToast('Failed to export data: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingData(false);
    }
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
                <label htmlFor="settings-subdomain" className="settings-field-label">Workspace Domain</label>
                <input
                  id="settings-subdomain"
                  type="text"
                  value={user?.workspaceName ? `${user.workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.myspace.ai` : 'workspace.myspace.ai'}
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
            title="AI Provider & Intelligence Engine"
            description="Connect your own API key (BYOK) for private low-latency reasoning with zero daily rate limits. Your key is AES-256 encrypted at rest and never shared."
          >
            {/* Current key status banner */}
            {byokHasKey ? (
              <div className="byok-status-banner byok-status-active">
                <CheckCircle2 size={16} aria-hidden="true" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>Active Custom AI Key ({byokProvider.toUpperCase()})</strong>
                    {byokLatency && (
                      <span className="byok-latency-badge">⚡ {byokLatency}ms</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Direct inference enabled via {byokModel || 'default model'}. Zero rate limits.
                  </span>
                </div>
                {byokKeyMasked && <code className="byok-masked-key">{byokKeyMasked}</code>}
              </div>
            ) : operatorConfigured ? (
              <div className="byok-status-banner byok-status-active">
                <Sparkles size={16} aria-hidden="true" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <strong>Shared Workspace AI Cluster Active</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Shared operator key active · Daily cap: {dailyCap} requests/day. Connect your own key below for unlimited requests.
                  </span>
                </div>
              </div>
            ) : (
              <div className="byok-status-banner byok-status-none">
                <AlertCircle size={16} aria-hidden="true" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <strong>Semantic Search & Local RAG Mode Active</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Connect a Google Gemini, OpenAI, or Groq API key below to unlock generative conversation, coding, and synthesis.
                  </span>
                </div>
              </div>
            )}

            <div className="settings-rows-group byok-form-grid">
              {/* Provider Selection */}
              <div className="settings-field-group">
                <label htmlFor="byok-provider" className="settings-field-label">AI Provider</label>
                <select
                  id="byok-provider"
                  className="settings-text-input byok-select"
                  value={byokProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  <option value="gemini">Google Gemini (Recommended - Free Tier Available)</option>
                  <option value="groq">Groq Cloud (Ultra-Fast Llama 3.3)</option>
                  <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                  <option value="openrouter">OpenRouter (Multi-Model Gateway)</option>
                  <option value="ollama">Ollama (Local Offline Self-Hosted)</option>
                  <option value="custom">Custom OpenAI-Compatible API</option>
                </select>
              </div>

              {/* Model Selection */}
              <div className="settings-field-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="byok-model-select" className="settings-field-label">Model Selection</label>
                  {(PROVIDER_PRESETS[byokProvider]?.models.length || 0) > 0 && (
                    <button
                      type="button"
                      className="byok-link-btn"
                      onClick={() => {
                        setCustomModelMode((v) => !v);
                        if (!customModelMode && !byokModel) {
                          setByokModel(PROVIDER_PRESETS[byokProvider]?.models[0]?.id || '');
                        }
                      }}
                    >
                      {customModelMode ? 'Use Recommended Models' : 'Enter Custom Model ID'}
                    </button>
                  )}
                </div>

                {!customModelMode && (PROVIDER_PRESETS[byokProvider]?.models.length || 0) > 0 ? (
                  <select
                    id="byok-model-select"
                    className="settings-text-input byok-select"
                    value={byokModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomModelMode(true);
                      } else {
                        setByokModel(e.target.value);
                      }
                    }}
                  >
                    {PROVIDER_PRESETS[byokProvider]?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                    <option value="__custom__">⚙️ Other / Custom Model ID...</option>
                  </select>
                ) : (
                  <input
                    id="byok-model"
                    type="text"
                    className="settings-text-input"
                    value={byokModel}
                    onChange={(e) => setByokModel(e.target.value)}
                    placeholder="e.g. gemini-1.5-flash, llama-3.3-70b-versatile, gpt-4o"
                  />
                )}
              </div>

              {/* API Key */}
              <div className="settings-field-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="byok-api-key" className="settings-field-label">
                    <Key size={13} aria-hidden="true" /> API Key
                  </label>
                  {PROVIDER_PRESETS[byokProvider]?.keyUrl && (
                    <a
                      href={PROVIDER_PRESETS[byokProvider].keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="byok-key-link"
                    >
                      {PROVIDER_PRESETS[byokProvider].keyLabel} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="byok-key-input-wrap">
                  <input
                    id="byok-api-key"
                    type={byokShowKey ? 'text' : 'password'}
                    className="settings-text-input byok-key-input"
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    placeholder={
                      byokHasKey 
                        ? '(Leave empty to keep saved key, or enter new key to replace)' 
                        : `Enter ${PROVIDER_PRESETS[byokProvider]?.name} Key (e.g. ${PROVIDER_PRESETS[byokProvider]?.keyPlaceholder})`
                    }
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
                <span className="field-hint">
                  Your key is AES-256-GCM encrypted and stored exclusively in your workspace vault.
                </span>
              </div>

              {/* Advanced Endpoint Options */}
              <div className="byok-advanced-toggle">
                <button
                  type="button"
                  className="byok-link-btn byok-advanced-btn"
                  onClick={() => setShowAdvancedUrl((v) => !v)}
                >
                  <Sliders size={13} /> {showAdvancedUrl ? 'Hide Endpoint Configuration' : 'Advanced Endpoint Configuration'}
                </button>
              </div>

              {showAdvancedUrl && (
                <div className="settings-field-group">
                  <label htmlFor="byok-base-url" className="settings-field-label">Base URL (API Endpoint)</label>
                  <input
                    id="byok-base-url"
                    type="url"
                    className="settings-text-input"
                    value={byokBaseUrl}
                    onChange={(e) => setByokBaseUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                  />
                  <span className="field-hint">
                    Standard OpenAI-compatible chat completion endpoint. Preconfigured automatically per provider.
                  </span>
                </div>
              )}
            </div>

            {/* Feedback message */}
            {byokStatus === 'error' && (
              <div className="byok-feedback byok-feedback-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {byokErrorMsg}
              </div>
            )}
            {byokStatus === 'success' && (
              <div className="byok-feedback byok-feedback-success" role="status">
                <CheckCircle2 size={14} aria-hidden="true" />
                Provider verified and connected successfully!
                {byokLatency && <span className="byok-latency-badge">⚡ {byokLatency}ms</span>}
              </div>
            )}

            <div className="settings-actions-footer byok-footer">
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                disabled={byokStatus === 'loading' || (!byokKey.trim() && !byokHasKey && byokProvider !== 'ollama')}
                onClick={async () => {
                  if (!byokKey.trim() && !byokHasKey && byokProvider !== 'ollama') {
                    setByokStatus('error');
                    setByokErrorMsg('Please enter an API key.');
                    return;
                  }
                  setByokStatus('loading');
                  setByokErrorMsg('');
                  try {
                    const saved = await api.saveAISettings({
                      provider: byokProvider,
                      apiKey: byokKey.trim() || undefined as any,
                      baseUrl: byokBaseUrl.trim() || undefined,
                      model: byokModel.trim() || undefined,
                    });
                    setByokStatus('success');
                    setByokKey('');
                    setByokHasKey(true);
                    setByokKeyMasked(saved.maskedKey || null);
                    if (saved.latencyMs) setByokLatency(saved.latencyMs);
                    showToast('AI engine verified and connected successfully!');
                    setTimeout(() => setByokStatus('idle'), 4000);
                  } catch (err: any) {
                    setByokStatus('error');
                    setByokErrorMsg(err.message || 'Failed to verify AI provider connection.');
                  }
                }}
              >
                {byokStatus === 'loading' ? (
                  <><Loader2 size={15} className="byok-spinner" aria-hidden="true" /> Verifying Connection…</>
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
                    if (!confirm('Disconnect your custom API key? The workspace will revert to standard mode.')) return;
                    setByokDeleting(true);
                    try {
                      await api.deleteAISettings();
                      setByokHasKey(false);
                      setByokKeyMasked(null);
                      setByokKey('');
                      setByokLatency(null);
                      setByokStatus('idle');
                      showToast('Custom API key removed.');
                    } catch (err: any) {
                      showToast(err.message || 'Failed to remove key. Please try again.');
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

            {/* Workspace RAG & Knowledge Index Status */}
            <div className="byok-index-section">
              <div className="byok-index-header">
                <Database size={16} className="byok-index-icon" />
                <div>
                  <h3 className="byok-index-title">Workspace Knowledge Index</h3>
                  <p className="byok-index-desc">
                    MySpace AI references your private workspace items with strict multi-tenant BM25 isolation.
                  </p>
                </div>
              </div>

              <div className="byok-index-grid">
                <div className="byok-index-card">
                  <FileText size={16} className="byok-card-icon" />
                  <div className="byok-card-text">
                    <span className="byok-card-value">{indexStats.notes}</span>
                    <span className="byok-card-label">Notes & Docs</span>
                  </div>
                </div>
                <div className="byok-index-card">
                  <CheckSquare size={16} className="byok-card-icon" />
                  <div className="byok-card-text">
                    <span className="byok-card-value">{indexStats.tasks}</span>
                    <span className="byok-card-label">Tasks Tracked</span>
                  </div>
                </div>
                <div className="byok-index-card">
                  <Bookmark size={16} className="byok-card-icon" />
                  <div className="byok-card-text">
                    <span className="byok-card-value">{indexStats.bookmarks}</span>
                    <span className="byok-card-label">Bookmarks</span>
                  </div>
                </div>
                <div className="byok-index-card">
                  <FolderKanban size={16} className="byok-card-icon" />
                  <div className="byok-card-text">
                    <span className="byok-card-value">{indexStats.projects}</span>
                    <span className="byok-card-label">Active Projects</span>
                  </div>
                </div>
              </div>
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
                description="Download all notes, tasks, bookmarks, and projects as a JSON backup."
                control={
                  <button 
                    type="button" 
                    className="settings-btn settings-btn-secondary"
                    disabled={exportingData}
                    onClick={handleExportArchive}
                  >
                    {exportingData ? (
                      <Loader2 size={16} className="byok-spinner" aria-hidden="true" />
                    ) : (
                      <Download size={16} aria-hidden="true" />
                    )}
                    {exportingData ? 'Exporting...' : 'Export Archive (.json)'}
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
