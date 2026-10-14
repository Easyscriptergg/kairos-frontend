import React, { useState } from 'react';
import { useKairos } from '../../data/store/KairosStore';
import { Field } from '../shared/SharedComponents';
import { MIN_PASSWORD_LENGTH } from '../../data/api/auth';
import { Zap, LogIn, UserPlus, AlertTriangle } from 'lucide-react';
import './SignInScreen.css';

type Mode = 'sign-in' | 'register';

/** Shown instead of a page when the API source is active and nobody is signed in. */
export default function SignInScreen() {
  const { state, actions } = useKairos();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registering = mode === 'register';
  const passwordTooShort = registering && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = registering && confirm.length > 0 && confirm !== password;
  const canSubmit = !busy && email.includes('@') && password.length > 0
    && (!registering || (password.length >= MIN_PASSWORD_LENGTH && confirm === password));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const failure = registering ? await actions.register(email.trim(), password) : await actions.signIn(email.trim(), password);
    setBusy(false);
    if (failure) setError(failure);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirm('');
  };

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit} noValidate>
        <div className="signin-brand">
          <span className="rail-brand-mark"><Zap size={22} strokeWidth={2.4} /></span>
          <div>
            <h1 className="signin-title">{registering ? 'Create your Kairos account' : 'Sign in to Kairos'}</h1>
            <p className="signin-sub">Your training, recovery and nutrition records are stored in your account.</p>
          </div>
        </div>

        {state.error && !error && (
          <p className="signin-notice" role="status"><AlertTriangle size={15} /> {state.error}</p>
        )}

        <div className="segmented signin-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={!registering} className={!registering ? 'active' : ''} onClick={() => switchMode('sign-in')}>Sign in</button>
          <button type="button" role="tab" aria-selected={registering} className={registering ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button>
        </div>

        <Field label="Email">
          <input className="control-input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" hint={registering ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}>
          <input
            className="control-input"
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={passwordTooShort}
            required
          />
        </Field>
        {registering && (
          <Field label="Confirm password">
            <input className="control-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} aria-invalid={mismatch} required />
          </Field>
        )}
        {(passwordTooShort || mismatch) && (
          <p className="form-error">{passwordTooShort ? `The password needs at least ${MIN_PASSWORD_LENGTH} characters.` : 'The passwords do not match.'}</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-lg signin-submit" type="submit" disabled={!canSubmit}>
          {registering ? <UserPlus size={16} /> : <LogIn size={16} />}
          {busy ? (registering ? 'Creating account…' : 'Signing in…') : registering ? 'Create account' : 'Sign in'}
        </button>

        <div className="signin-divider"><span>or</span></div>
        <button type="button" className="btn btn-secondary" onClick={() => actions.setMode('demo')}>
          Explore the demo athlete instead
        </button>
        <p className="signin-foot">The demo uses sample data and does not need an account. Nothing you log there is saved to an account.</p>
      </form>
    </div>
  );
}
