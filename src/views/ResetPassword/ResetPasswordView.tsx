import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Check, Loader2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { MySpaceLogo } from '../../components/Brand/MySpaceLogo';
import { api } from '../../services/api';
import './ResetPasswordView.css';

const MIN_PASSWORD_LENGTH = 10;

interface ResetPasswordViewProps {
  onGoToLogin: () => void;
  onGoToForgot: () => void;
}

type PageState = 'form' | 'success' | 'error';

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onGoToLogin, onGoToForgot }) => {
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorCode, setErrorCode] = useState<string>('');
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) {
      setPageState('error');
      setErrorCode('INVALID_OR_EXPIRED_TOKEN');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setFieldError('Please enter a new password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setFieldError(undefined);
    try {
      await api.resetPassword(token, newPassword);
      setPageState('success');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'INVALID_OR_EXPIRED_TOKEN' || err.status === 400) {
        setPageState('error');
        setErrorCode('INVALID_OR_EXPIRED_TOKEN');
      } else {
        setFieldError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-pw-root">
      <div className="reset-pw-card" role="main" aria-label="Reset Password">
        {/* Brand Header */}
        <div className="reset-pw-brand">
          <MySpaceLogo size={42} />
          <div className="reset-pw-brand-text">
            <span className="reset-pw-brand-name">MySpace<span className="reset-pw-brand-accent">AI</span></span>
            <span className="reset-pw-brand-tagline">Your Mind, Organized</span>
          </div>
        </div>

        {/* ── Success State ───────────────────────────────────────────────────── */}
        {pageState === 'success' && (
          <div className="reset-pw-state-container">
            <div className="reset-pw-state-icon reset-pw-state-icon--success">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="reset-pw-state-title">Password Updated</h1>
            <p className="reset-pw-state-desc">
              Your password has been changed successfully. All existing sessions have been signed out for your security.
              You can now sign in with your new password.
            </p>
            <button
              id="reset-pw-goto-login"
              type="button"
              className="btn btn-primary reset-pw-action-btn"
              onClick={onGoToLogin}
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* ── Error State ────────────────────────────────────────────────────── */}
        {pageState === 'error' && (
          <div className="reset-pw-state-container">
            <div className="reset-pw-state-icon reset-pw-state-icon--error">
              <AlertCircle size={32} />
            </div>
            <h1 className="reset-pw-state-title">Link Expired or Invalid</h1>
            <p className="reset-pw-state-desc">
              {errorCode === 'INVALID_OR_EXPIRED_TOKEN'
                ? 'This password reset link has expired or has already been used. Reset links are valid for 30 minutes.'
                : 'Something went wrong. Please request a new reset link.'}
            </p>
            <button
              id="reset-pw-request-new"
              type="button"
              className="btn btn-primary reset-pw-action-btn"
              onClick={onGoToForgot}
            >
              Request New Reset Link
            </button>
            <button
              type="button"
              className="reset-pw-back-link"
              onClick={onGoToLogin}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* ── Form State ─────────────────────────────────────────────────────── */}
        {pageState === 'form' && (
          <>
            <div className="reset-pw-header">
              <div className="reset-pw-icon-wrap">
                <KeyRound size={22} />
              </div>
              <h1 className="reset-pw-title">Choose New Password</h1>
              <p className="reset-pw-sub">
                Create a strong new password for your MySpace AI account.
              </p>
            </div>

            <form className="reset-pw-form" onSubmit={handleSubmit} noValidate>
              <div className="reset-pw-form-group">
                <label htmlFor="reset-pw-input">New Password</label>
                <div className={`reset-pw-input-wrap ${fieldError ? 'has-error' : ''}`}>
                  <Lock size={16} className="reset-pw-input-icon" />
                  <input
                    id="reset-pw-input"
                    type={showPassword ? 'text' : 'password'}
                    name="newPassword"
                    placeholder="At least 10 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (fieldError) setFieldError(undefined);
                    }}
                    autoComplete="new-password"
                    aria-invalid={!!fieldError}
                    aria-describedby={fieldError ? 'reset-pw-error' : 'reset-pw-hint'}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="reset-pw-eye-btn"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {fieldError ? (
                  <span id="reset-pw-error" className="reset-pw-field-error" role="alert">
                    {fieldError}
                  </span>
                ) : (
                  <div
                    id="reset-pw-hint"
                    className={`reset-pw-hint ${newPassword.length >= MIN_PASSWORD_LENGTH ? 'is-valid' : ''}`}
                  >
                    {newPassword.length >= MIN_PASSWORD_LENGTH ? (
                      <Check size={13} className="reset-pw-hint-icon" />
                    ) : (
                      <span className="reset-pw-hint-bullet">•</span>
                    )}
                    <span>At least {MIN_PASSWORD_LENGTH} characters.</span>
                  </div>
                )}
              </div>

              <button
                id="reset-pw-submit"
                type="submit"
                className="btn btn-primary reset-pw-submit-btn"
                disabled={loading || (newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH)}
                aria-busy={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="reset-pw-spinner" />
                ) : null}
                <span>{loading ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>

            <div className="reset-pw-footer">
              <button type="button" className="reset-pw-back-link" onClick={onGoToLogin}>
                Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
