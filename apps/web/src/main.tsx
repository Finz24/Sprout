import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
  Link,
  useNavigate,
} from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { Login } from './login.js';
import { session, safeReturn } from './session.js';
import { LibraryPage } from './library/page.js';
import { OriginalSearch } from './library/search.js';
import { TextInspector } from './library/inspector.js';
import {
  AccessStatus,
  Placeholder,
  Settings,
  Shell,
  useSession,
} from './shell.js';
import './styles.css';
import './library/library.css';

function returnDestination(value: unknown) {
  const url = new URL(safeReturn(value), window.location.origin);
  if (url.pathname === '/search')
    return {
      to: '/search',
      search: { q: url.searchParams.get('q') ?? '' },
    } as const;
  if (url.pathname === '/settings') return { to: '/settings' } as const;
  if (url.pathname === '/spaces') return { to: '/spaces' } as const;
  const space = /^\/spaces\/([^/]+)$/.exec(url.pathname);
  if (space?.[1])
    return { to: '/spaces/$spaceId', params: { spaceId: space[1] } } as const;
  const item = /^\/library\/items\/([^/]+)$/.exec(url.pathname);
  if (item?.[1])
    return {
      to: '/library/items/$itemId',
      params: { itemId: item[1] },
      search: { from: '/library' },
    } as const;
  return { to: '/library' } as const;
}
function safeReturnRedirect(value: unknown) {
  return { ...returnDestination(value), replace: true };
}
function LoginPage() {
  const state = useSession();
  const navigate = useNavigate();
  const { returnTo } = loginRoute.useSearch();
  if (state.kind === 'LogoutFailed' || state.kind === 'SigningOut')
    return <AccessStatus />;
  return (
    <Login
      onSignedIn={() =>
        navigate({ ...returnDestination(returnTo), replace: true })
      }
    />
  );
}

const rootRoute = createRootRoute({
  component: Outlet,
  pendingComponent: AccessStatus,
  errorComponent: AccessStatus,
  notFoundComponent: () => (
    <main className="access-page">
      <h1>Page not found</h1>
      <Link to="/library">Go to Library</Link>
    </main>
  ),
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (input: Record<string, unknown>) => ({
    returnTo: safeReturn(input.returnTo),
  }),
  beforeLoad: async ({ search }) => {
    const known = session.snapshot();
    const state = known.kind === 'Anonymous' ? known : await session.enter();
    if (state.kind === 'Ready')
      throw redirect(safeReturnRedirect(search.returnTo));
  },
  component: LoginPage,
});
const privateRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  component: Shell,
  beforeLoad: async ({ location }) => {
    const state = await session.enter();
    if (state.kind === 'Anonymous')
      throw redirect({
        to: '/login',
        search: { returnTo: safeReturn(location.href) },
        replace: true,
      });
    if (state.kind !== 'Ready') throw new Error('Access unavailable');
  },
  errorComponent: AccessStatus,
});
const indexRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/library', replace: true });
  },
});
const libraryRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/library',
  component: LibraryPage,
});
const inspectorRoute = createRoute({
  getParentRoute: () => libraryRoute,
  path: '/items/$itemId',
  validateSearch: (input: Record<string, unknown>) => ({
    from: safeReturn(input.from),
  }),
  component: () => <TextInspector itemId={inspectorRoute.useParams().itemId} />,
});
const searchRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/search',
  validateSearch: (input: Record<string, unknown>) => ({
    q: typeof input.q === 'string' ? input.q.slice(0, 500) : '',
  }),
  component: OriginalSearch,
});
const spacesRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/spaces',
  component: Outlet,
});
const spacesIndexRoute = createRoute({
  getParentRoute: () => spacesRoute,
  path: '/',
  component: () => (
    <Placeholder title="Spaces">Spaces are not available yet.</Placeholder>
  ),
});
const spaceRoute = createRoute({
  getParentRoute: () => spacesRoute,
  path: '/$spaceId',
  component: () => (
    <Placeholder title="Space unavailable">
      This space is unavailable. Spaces will arrive in a future update.
    </Placeholder>
  ),
});
const settingsRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/settings',
  component: Settings,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([
    loginRoute,
    privateRoute.addChildren([
      indexRoute,
      libraryRoute.addChildren([inspectorRoute]),
      searchRoute,
      spacesRoute.addChildren([spacesIndexRoute, spaceRoute]),
      settingsRoute,
    ]),
  ]),
  defaultPreload: false,
  defaultGcTime: 0,
  defaultPendingMs: 0,
});
session.bind(() => {
  router.clearCache();
});
window.addEventListener('focus', () => {
  void router.invalidate();
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
