import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@sprout/ui';
import { AccessLayout } from './access-layout.js';
import { session } from './session.js';

type LoginStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'rate-limited'; readonly message: string };

function useLoginForm(onSignedIn: () => Promise<void>) {
  const [status, setStatus] = useState<LoginStatus>(() => ({
    kind: session.snapshot().kind === 'Unavailable' ? 'unavailable' : 'idle',
  }));
  const passwordInput = useRef<HTMLInputElement>(null);
  const submit = async (data: FormData) => {
    if (status.kind === 'pending') return;
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    setStatus({ kind: 'pending' });
    try {
      const error = await session.signIn(email, password);
      if (!error) {
        await onSignedIn();
      } else if (session.snapshot().kind === 'Unavailable') {
        setStatus({ kind: 'unavailable' });
      } else if (error === 'Too many attempts. Try again shortly.') {
        setStatus({ kind: 'rate-limited', message: error });
      } else {
        if (passwordInput.current) passwordInput.current.value = '';
        setStatus({ kind: 'invalid' });
      }
    } catch {
      setStatus({ kind: 'unavailable' });
    }
  };
  return { status, passwordInput, submit };
}

function LoginNotice({
  id,
  info = false,
  children,
}: {
  id: string;
  info?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`access-alert${info ? ' access-info' : ''}`}
      role="alert"
      id={id}
    >
      <svg className="access-alert-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <path d="M9.1 6h1.8v5.2H9.1zm0 6.6h1.8v1.8H9.1z" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

function LoginError({ status }: { status: LoginStatus }) {
  switch (status.kind) {
    case 'invalid':
      return (
        <LoginNotice id="login-error">
          <strong>That email and password don't match.</strong>Check them and
          try again. Your email is kept.
        </LoginNotice>
      );
    case 'rate-limited':
      return <LoginNotice id="login-error">{status.message}</LoginNotice>;
    case 'idle':
    case 'pending':
    case 'unavailable':
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function Login({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const { status, passwordInput, submit } = useLoginForm(onSignedIn);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const pending = status.kind === 'pending';
  const invalid = status.kind === 'invalid';
  const hasError = invalid || status.kind === 'rate-limited';
  const errorDescription = hasError
    ? 'login-error'
    : status.kind === 'unavailable'
      ? 'login-unavailable'
      : undefined;

  return (
    <AccessLayout>
      <h1>Welcome back</h1>
      <p className="access-subtitle">Sign in to your library.</p>
      <form
        className="login-form"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          setShowPassword(false);
          void submit(new FormData(event.currentTarget));
        }}
      >
        {status.kind === 'unavailable' && (
          <LoginNotice id="login-unavailable" info>
            <strong>Can't reach Sprout right now.</strong>
            If your PC is asleep, wake it and try again. Nothing was lost.
          </LoginNotice>
        )}
        {showHelp && (
          <div className="access-alert access-info" role="note" id="login-help">
            <svg
              className="access-alert-icon"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8" />
              <path d="M9.1 9h1.8v5.4H9.1zm0-3.2h1.8v1.8H9.1z" />
            </svg>
            <div>
              <strong>Sprout is private.</strong>
              There's no public sign-up. The owner account is created once on
              the host PC with <code>pnpm auth:bootstrap</code>, then you sign
              in here.
            </div>
          </div>
        )}
        <div className="login-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
            maxLength={254}
            disabled={pending}
            aria-invalid={invalid}
            aria-describedby={errorDescription}
          />
        </div>
        <div className="login-field">
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              ref={passwordInput}
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={pending}
              aria-invalid={invalid}
              aria-describedby={errorDescription}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              aria-controls="password"
              disabled={pending}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <LoginError status={status} />
        <Button className="login-submit" type="submit" disabled={pending}>
          {pending && <span className="login-spinner" aria-hidden="true" />}
          {pending
            ? 'Signing in…'
            : status.kind === 'unavailable'
              ? 'Try again'
              : 'Sign in'}
        </Button>
        <div className="login-help">
          New here?{' '}
          <button
            type="button"
            aria-expanded={showHelp}
            aria-controls="login-help"
            onClick={() => setShowHelp(!showHelp)}
          >
            How sign-in works
          </button>
        </div>
      </form>
    </AccessLayout>
  );
}
