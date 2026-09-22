import React, { useState } from 'react';
import { User, Lock, Mail, X, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { MySpaceLogo } from '../Brand/MySpaceLogo';
import { api } from '../../services/api';
import type { UserSession } from '../../services/api';
import './AuthModal.css';

// Must stay in sync with signupSchema password min in server/validation/schemas.ts (currently 10)
const MIN_PASSWORD_LENGTH = 10;

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  if (!isOpen) return null;

  const handleClose = () => {
    setShowPassword(false);
    setFieldErrors({});
    onClose();
  };

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setShowPassword(false);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; password?: string; name?: string } = {};

    if (mode === 'signup' && !name.trim()) {
      errors.name = 'Please enter your full name.';
    }
    if (!email.trim()) {
      errors.email = 'Please enter your email address.';
    }
    if (!password.trim()) {
      errors.password = 'Please enter your password.';
    } else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setFieldErrors({});
    try {
      if (mode === 'login') {
        const result = await api.login(email.trim(), password);
        showToast(`Welcome back, ${result.user.name}!`);
        onAuthSuccess(result.user);
        handleClose();
      } else {
        const result = await api.signup(email.trim(), password, name.trim());
        showToast(`Account created for ${result.user.name}!`);
        onAuthSuccess(result.user);
        handleClose();
      }
    } catch (err: any) {
      // 1. Structured validation fields from backend
      if (err.fields && typeof err.fields === 'object' && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
        return;
      }
      if (err.error?.fields && typeof err.error.fields === 'object') {
        setFieldErrors(err.error.fields);
        return;
      }

      const code = err.code || err.error?.code;
      const message = err.message || '';

      // 2. INVALID_CREDENTIALS -> highlight both email and password
      if (
        code === 'INVALID_CREDENTIALS' ||
        /invalid.*password|incorrect.*password|credential/i.test(message)
      ) {
        setFieldErrors({
          email: 'Incorrect email or password.',
          password: 'Incorrect email or password.',
        });
        return;
      }

      // 3. EMAIL_EXISTS (signup) -> highlight email field
      if (
        code === 'EMAIL_EXISTS' ||
        /already exists|email exists/i.test(message)
      ) {
        setFieldErrors({
          email: 'An account with this email already exists.',
        });
        return;
      }

      // 4. VALIDATION_ERROR mapped to field
      if (code === 'VALIDATION_ERROR') {
        if (/email/i.test(message)) {
          setFieldErrors({ email: message });
          return;
        }
        if (/password/i.test(message)) {
          setFieldErrors({ password: message });
          return;
        }
        if (/name/i.test(message)) {
          setFieldErrors({ name: message });
          return;
        }
      }

      // 5. Fallback toast only for unmapped errors
      showToast(message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setFieldErrors({});
    try {
      const result = await api.login('nabin@workspace.ai', 'password123');
      showToast(`Logged into ${result.user.workspaceName}`);
      onAuthSuccess(result.user);
      handleClose();
    } catch (err: any) {
      showToast(err.message || 'Demo login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || (mode === 'signup' && password.length > 0 && password.length < MIN_PASSWORD_LENGTH);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="btn-icon auth-modal-close" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-modal-header">
          <div className="auth-brand-glyph">
            <MySpaceLogo size={44} />
            <div className="auth-brand-wordmark">
              <span className="auth-brand-name">MySpace<span className="auth-brand-accent">AI</span></span>
              <span className="auth-brand-tagline">Your Mind, Organized</span>
            </div>
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

        {/* 1-Click Quick Demo Access (Evaluation only, hidden in production) */}
        {import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' && (
          <>
            <div className="demo-login-strip">
              <div className="demo-info">
                <span className="demo-title">Demo Workspace</span>
                <span className="demo-desc">Sample data • For evaluation only</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm demo-login-btn"
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
          </>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name</label>
              <div className={`auth-input-wrap ${fieldErrors.name ? 'has-error' : ''}`}>
                <User size={16} className="auth-input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  name="name"
                  placeholder="e.g. Nabin Thapa"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                />
              </div>
              {fieldErrors.name && (
                <span id="auth-name-error" className="auth-field-error" role="alert">
                  {fieldErrors.name}
                </span>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <div className={`auth-input-wrap ${fieldErrors.email ? 'has-error' : ''}`}>
              <Mail size={16} className="auth-input-icon" />
              <input
                id="auth-email"
                type="email"
                name="email"
                placeholder="name@workspace.ai"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
              />
            </div>
            {fieldErrors.email && (
              <span id="auth-email-error" className="auth-field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div className={`auth-input-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
              <Lock size={16} className="auth-input-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="has-toggle"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password
                    ? 'auth-password-error'
                    : mode === 'signup'
                      ? 'auth-password-hint'
                      : undefined
                }
              />
              <button
                type="button"
                className="auth-password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="auth-password-error" className="auth-field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
            {mode === 'signup' && (
              <div
                id="auth-password-hint"
                className={`auth-password-hint ${password.length >= MIN_PASSWORD_LENGTH ? 'is-valid' : ''}`}
              >
                {password.length >= MIN_PASSWORD_LENGTH ? (
                  <Check size={13} className="auth-hint-icon" />
                ) : (
                  <span className="auth-hint-bullet">•</span>
                )}
                <span>At least {MIN_PASSWORD_LENGTH} characters.</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={isSubmitDisabled}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 size={16} className="auth-spinner" />
            ) : null}
            <span>
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                  ? 'Sign In to Workspace'
                  : 'Create Private Space'}
            </span>
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <div className="auth-footer-toggle">
          {mode === 'login' ? (
            <p>
              Don't have a workspace yet?{' '}
              <button type="button" className="auth-link-btn" onClick={() => switchMode('signup')}>
                Create new workspace
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="auth-link-btn" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
