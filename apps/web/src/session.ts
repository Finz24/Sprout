import { Schema } from 'effect';
import { Access, ShellSummary, type LibraryView } from '@sprout/contracts';

type Authenticated = Extract<Access, { kind: 'Authenticated' }>;
export type SessionState =
  | { readonly kind: 'Checking' }
  | {
      readonly kind: 'Ready';
      readonly access: Authenticated;
      readonly shell: ShellSummary;
    }
  | { readonly kind: 'Anonymous' }
  | { readonly kind: 'Unavailable' }
  | { readonly kind: 'SigningOut' }
  | { readonly kind: 'LogoutFailed' };

export function safeReturn(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    [...value].some(
      (character) => character === '\\' || character.charCodeAt(0) <= 0x20,
    )
  )
    return '/library';
  try {
    const url = new URL(value, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      url.hash ||
      !/^\/(?:library(?:\/items\/[^/%]+)?|search|spaces(?:\/[^/%]+)?|settings)$/.test(
        url.pathname,
      )
    )
      return '/library';
    const query = new URLSearchParams();
    if (url.pathname === '/search')
      query.set('q', (url.searchParams.get('q') ?? '').slice(0, 500));
    return `${url.pathname}${query.size ? `?${query}` : ''}`;
  } catch {
    return '/library';
  }
}

const logoutKey = 'sprout.logout-pending';
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
let generation = 0;
let state: SessionState = { kind: 'Checking' };
let pending: Promise<SessionState> | undefined;
let invalidate = () => {};
const channel =
  typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel('sprout-access');
const emit = (next: SessionState) => {
  state = next;
  for (const listener of listeners) listener();
};
const isLogoutPending = () => {
  try {
    return localStorage.getItem(logoutKey) === '1';
  } catch {
    return false;
  }
};
const persistLogout = (value: boolean) => {
  try {
    if (value) localStorage.setItem(logoutKey, '1');
    else localStorage.removeItem(logoutKey);
  } catch {
    /* Cross-tab messages still work when storage is unavailable. */
  }
};
function clear(next: SessionState) {
  generation++;
  for (const controller of requests) controller.abort();
  requests.clear();
  pending = undefined;
  emit(next);
  invalidate();
}
class StaleResponse extends Error {}
async function request(path: string, init: RequestInit = {}) {
  const version = generation;
  const controller = new AbortController();
  requests.add(controller);
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    const body: unknown = response.ok ? await response.json() : undefined;
    if (version !== generation) throw new StaleResponse();
    return { response, body };
  } finally {
    requests.delete(controller);
  }
}
function expired(broadcast = false) {
  clear({ kind: 'Anonymous' });
  if (broadcast) channel?.postMessage('expired');
}

export const session = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: () => state,
  async privateRequest(path: string, init: RequestInit = {}) {
    if (state.kind !== 'Ready') throw new StaleResponse();
    const result = await request(path, init);
    if (result.response.status === 401) {
      expired(true);
      throw new StaleResponse();
    }
    return result;
  },
  bind: (callback: () => void) => {
    invalidate = callback;
  },
  async enter(): Promise<SessionState> {
    if (isLogoutPending()) {
      emit({ kind: 'LogoutFailed' });
      return state;
    }
    if (pending) return pending;
    const version = generation;
    const wasAuthenticated = state.kind === 'Ready';
    emit({ kind: 'Checking' });
    pending = (async () => {
      try {
        const result = await request('/api/session');
        const access = Schema.decodeUnknownSync(Access)(result.body);
        if (!result.response.ok || access.kind === 'Unavailable')
          throw new Error('Unavailable');
        if (access.kind === 'Anonymous') {
          if (wasAuthenticated) expired(true);
          else emit({ kind: 'Anonymous' });
          return state;
        }
        const shell = await request('/api/shell');
        if (shell.response.status === 401) {
          if (wasAuthenticated) expired(true);
          else emit({ kind: 'Anonymous' });
          return state;
        }
        if (!shell.response.ok) throw new Error('Unavailable');
        const summary = Schema.decodeUnknownSync(ShellSummary)(shell.body);
        if (version !== generation) return state;
        emit({ kind: 'Ready', access, shell: summary });
      } catch (error) {
        if (version === generation && !(error instanceof StaleResponse))
          emit({ kind: 'Unavailable' });
      } finally {
        if (version === generation) pending = undefined;
      }
      if (version !== generation && state.kind === 'Checking')
        return session.enter();
      return state;
    })();
    return pending;
  },
  async signIn(email: string, password: string) {
    clear({ kind: 'Checking' });
    const version = generation;
    try {
      const { response } = await request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        emit({ kind: response.status >= 500 ? 'Unavailable' : 'Anonymous' });
        return response.status === 429
          ? 'Too many attempts. Try again shortly.'
          : response.status >= 500
            ? 'Sign in is unavailable. Try again.'
            : 'Invalid email or password.';
      }
      await session.enter();
      return state.kind === 'Ready'
        ? undefined
        : 'Sign in is unavailable. Try again.';
    } catch {
      if (version === generation) emit({ kind: 'Unavailable' });
      return 'Sign in is unavailable. Try again.';
    }
  },
  async signOut() {
    persistLogout(true);
    clear({ kind: 'SigningOut' });
    channel?.postMessage('logout');
    try {
      const { response } = await request('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Unavailable');
      persistLogout(false);
      clear({ kind: 'Anonymous' });
      channel?.postMessage('revoked');
    } catch {
      emit({ kind: 'LogoutFailed' });
    }
  },
  async setView(libraryView: LibraryView) {
    const current = state;
    if (current.kind !== 'Ready') return false;
    try {
      const { response } = await request('/api/settings/library-view', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ libraryView }),
      });
      if (response.status === 401) {
        expired(true);
        return false;
      }
      if (!response.ok) throw new Error('Unavailable');
      emit({ ...current, shell: { ...current.shell, libraryView } });
      return true;
    } catch (error) {
      if (!(error instanceof StaleResponse) && state.kind === 'Ready')
        clear({ kind: 'Unavailable' });
      return false;
    }
  },
};

channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.data === 'logout') clear({ kind: 'LogoutFailed' });
  if (event.data === 'revoked' || event.data === 'expired')
    clear({ kind: 'Anonymous' });
});
window.addEventListener('storage', (event) => {
  if (event.key === logoutKey)
    clear({ kind: event.newValue === '1' ? 'LogoutFailed' : 'Anonymous' });
});
const refocus = () => {
  if (document.visibilityState === 'visible') {
    clear({ kind: isLogoutPending() ? 'LogoutFailed' : 'Checking' });
    void session.enter();
  }
};
window.addEventListener('focus', refocus);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) refocus();
});
document.addEventListener('visibilitychange', refocus);
