import React, { useState } from 'react';
import { User, Lock, Mail, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { MySpaceLogo } from '../Brand/MySpaceLogo';
import { api } from '../../services/api';
import type { UserSession } from '../../services/api';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserSession) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  showToast,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter both email and password', 'error');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await api.login(email.trim(), password);
        showToast(`Welcome back, ${result.user.name}!`);
        onAuthSuccess(result.user);
        onClose();
      } else {
        const result = await api.signup(email.trim(), password, name.trim());
        showToast(`Account created for ${result.user.name}!`);
        onAuthSuccess(result.user);
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    try {
      const result = await api.login('nabin@workspace.ai', 'password123');
      showToast(`Logged into ${result.user.workspaceName}`);
      onAuthSuccess(result.user);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Demo login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="btn-icon auth-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-modal-header">
          <div className="auth-brand-glyph">
            <MySpaceLogo full width={180} />
          </div>
          <h2 className="auth-modal-title">
            {mode === 'login' ? 'Enter Your Workspace' : 'Create Your Private AI Space'}
          </h2>
          <p className="auth-modal-sub">
            {mode === 'login'
              ? 'Multi-tenant encrypted personal knowledge & task space'
              : 'Isolated database partition with dedicated local vector indexing'}
          </p>
        </div>

        {/* 1-Click Quick Demo Access */}
        <div className="demo-login-strip">
          <div className="demo-info">
            <span className="demo-title">Lead Engineer Workspace</span>
            <span className="demo-desc">nabin@workspace.ai • Full engineering data</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleQuickDemoLogin}
            disabled={loading}
          >
            <ShieldCheck size={14} />
            <span>Load Workspace</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Nabin Thapa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                name="email"
                placeholder="name@workspace.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            <span>{loading ? 'Authenticating...' : mode === 'login' ? 'Sign In to Workspace' : 'Create Private Space'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="auth-footer-toggle">
          {mode === 'login' ? (
            <p>
              Don't have a workspace yet?{' '}
              <button type="button" className="auth-link-btn" onClick={() => setMode('signup')}>
                Create new workspace
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="auth-link-btn" onClick={() => setMode('login')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
