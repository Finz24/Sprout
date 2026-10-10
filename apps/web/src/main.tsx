import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { Button, Input } from '@sprout/ui';
import type { WorkspaceResponse } from '@sprout/contracts';
import './styles.css';

function Layout() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [state, setState] = useState<
    'loading' | 'ready' | 'signedOut' | 'unavailable'
  >('loading');
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const refreshGeneration = useRef(0);
  const activeRefresh = useRef<AbortController | null>(null);
  const cancelRefresh = useCallback(() => {
    refreshGeneration.current++;
    activeRefresh.current?.abort();
  }, []);
  const refresh = useCallback(async () => {
    cancelRefresh();
    const generation = refreshGeneration.current;
    const controller = new AbortController();
    activeRefresh.current = controller;
    try {
      const response = await fetch('/api/private/workspace', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (generation !== refreshGeneration.current) return;
      if (response.status === 401) {
        setWorkspace(null);
        setState('signedOut');
        return;
      }
      if (!response.ok) throw new Error();
      const current = (await response.json()) as WorkspaceResponse;
      if (generation !== refreshGeneration.current) return;
      setWorkspace(current);
      setState('ready');
    } catch {
      if (generation !== refreshGeneration.current) return;
      setWorkspace(null);
      setState('unavailable');
    }
  }, [cancelRefresh]);
  useEffect(() => {
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      cancelRefresh();
    };
  }, [refresh, cancelRefresh]);
  useEffect(() => {
    if (!workspace) return;
    const timer = window.setTimeout(
      () => {
        cancelRefresh();
        setWorkspace(null);
        setState('signedOut');
      },
      Math.max(0, Date.parse(workspace.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [workspace, cancelRefresh]);
  const closeMenu = () => {
    setMenu(false);
    menuButton.current?.focus();
  };
  if (state === 'loading')
    return (
      <main className="grid min-h-dvh place-items-center">
        <p role="status">Opening your workspace...</p>
      </main>
    );
  if (state === 'unavailable')
    return (
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="text-2xl font-semibold">
          Your workspace is unavailable
        </h1>
        <p className="my-4 text-muted-foreground">
          Please try again when Sprout is available.
        </p>
        <Button onClick={() => void refresh()}>Try again</Button>
      </main>
    );
  if (state === 'signedOut' || !workspace) return <Login onSignIn={refresh} />;
  const signOut = async () => {
    cancelRefresh();
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      cancelRefresh();
      if (!response.ok) throw new Error();
      setWorkspace(null);
      setState('signedOut');
    } catch {
      cancelRefresh();
      setWorkspace(null);
      setState('unavailable');
    }
  };
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to library
      </a>
      <header className="flex items-center justify-between border-b border-border px-5 py-4 md:hidden">
        <span className="text-xl font-semibold">Sprout</span>
        <Button
          ref={menuButton}
          variant="outline"
          aria-expanded={menu}
          aria-controls="sidebar"
          onClick={() => setMenu(!menu)}
        >
          Menu
        </Button>
      </header>
      <div className="md:grid md:min-h-dvh md:grid-cols-[15rem_1fr]">
        <aside
          id="sidebar"
          className={`${menu ? 'block' : 'hidden'} border-b border-border bg-muted px-5 py-6 md:flex md:flex-col md:border-b-0 md:border-r`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeMenu();
          }}
        >
          <Link
            to="/"
            className="mb-12 hidden text-2xl font-semibold tracking-tight md:block"
          >
            Sprout<span className="text-primary">.</span>
          </Link>
          <nav aria-label="Workspace" className="space-y-2">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'bg-accent' }}
              className="flex min-h-12 items-center rounded-md px-3 font-medium"
              onClick={closeMenu}
            >
              Library
            </Link>
            <Link
              to="/search"
              search={{ q: '' }}
              activeProps={{ className: 'bg-accent' }}
              className="flex min-h-12 items-center rounded-md px-3 font-medium"
              onClick={closeMenu}
            >
              Search
            </Link>
            <Link
              to="/inspector"
              activeProps={{ className: 'bg-accent' }}
              className="flex min-h-12 items-center rounded-md px-3 font-medium"
              onClick={closeMenu}
            >
              Inspector
            </Link>
          </nav>
          <div className="mt-10 border-t border-border pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spaces
            </p>
            <p className="text-sm text-muted-foreground">No Spaces yet</p>
          </div>
          <div className="mt-auto pt-10">
            <p className="mb-3 break-words text-sm text-muted-foreground">
              {workspace.owner.name}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </aside>
        <main
          id="workspace"
          tabIndex={-1}
          className="min-w-0 px-6 py-10 sm:px-10 lg:px-14"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Login({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fields.get('email'),
          password: fields.get('password'),
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many attempts. Please try again shortly.'
            : 'Could not sign in. Check your email and password.',
        );
        return;
      }
      await onSignIn();
    } catch {
      setError('Sprout is unavailable. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <section className="w-full max-w-sm">
        <p className="mb-12 text-2xl font-semibold tracking-tight">
          Sprout<span className="text-primary">.</span>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Sign in to Sprout
        </h1>
        <p className="mb-8 mt-3 text-muted-foreground">
          Your saved world, privately yours.
        </p>
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          Access is limited to the owner. Public signup is closed.
        </p>
      </section>
    </main>
  );
}
function Library() {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Personal workspace
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Your library</h1>
        <Link
          to="/search"
          search={{ q: '' }}
          className="rounded-md border border-border px-4 py-3 text-sm font-medium"
        >
          Search library
        </Link>
      </div>
      <div className="mt-16 max-w-lg border-l-2 border-border pl-6">
        <h2 className="text-xl font-medium">Room for what matters.</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Your library is empty. Saved items will appear here when saving
          becomes available.
        </p>
      </div>
    </section>
  );
}
function Search() {
  const { q } = searchRoute.useSearch();
  const navigate = useNavigate({ from: '/search' });
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        Search your library
      </h1>
      <form
        className="mt-8 flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('query');
          void navigate({ search: { q: String(query ?? '') } });
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="query" className="sr-only">
            Search library
          </label>
          <Input
            id="query"
            name="query"
            type="search"
            placeholder="What do you want to find?"
            defaultValue={q}
            key={q}
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p role="status" className="mt-8 text-muted-foreground">
        {q
          ? `No saved items to search for ${q}.`
          : 'Your library is empty. There are no saved items to search yet.'}
      </p>
    </section>
  );
}
function Inspector() {
  return (
    <section className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Inspector</h1>
        <Link
          to="/"
          className="rounded-md border border-border px-4 py-3 text-sm font-medium"
        >
          Back to library
        </Link>
      </div>
      <div className="mt-12 border-l-2 border-border pl-6">
        <h2 className="text-xl font-medium">No item selected</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Open a saved item from your library to inspect it here.
        </p>
      </div>
    </section>
  );
}
const rootRoute = createRootRoute({ component: Layout });
const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Library,
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
});
const inspectorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inspector',
  component: Inspector,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([libraryRoute, searchRoute, inspectorRoute]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
);
