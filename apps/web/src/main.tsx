import { StrictMode } from 'react';
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
import { Button } from '@sprout/ui';
import './styles.css';

function Layout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-border px-6 py-6">
        <Link
          to="/"
          className="text-xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Sprout
        </Link>
        <nav aria-label="Main navigation" className="flex gap-5 text-sm">
          <Link
            to="/"
            activeProps={{ className: 'underline underline-offset-4' }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link
            to="/foundation"
            activeProps={{ className: 'underline underline-offset-4' }}
          >
            Foundation
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <Outlet />
      </main>
    </div>
  );
}
function Home() {
  const navigate = useNavigate();
  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        A place for what you want to keep.
      </h1>
      <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
        Sprout's development foundation is running. Saving, understanding, and
        organizing your information will arrive in the next slices.
      </p>
      <Button onClick={() => void navigate({ to: '/foundation' })}>
        View foundation
      </Button>
    </section>
  );
}
function Foundation() {
  return (
    <section className="max-w-xl space-y-7">
      <h1 className="text-3xl font-semibold tracking-tight">
        Development foundation
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        The web, API, and worker are separate applications. The worker is idle
        until processing is implemented.
      </p>
      <dl className="divide-y divide-border">
        <div className="flex flex-wrap justify-between gap-2 py-4">
          <dt className="font-medium">Web</dt>
          <dd>React / Vite / TanStack Router</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 py-4">
          <dt className="font-medium">API and worker</dt>
          <dd>Node / Effect</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 py-4">
          <dt className="font-medium">Database</dt>
          <dd>PostgreSQL / Drizzle / pgvector</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        Authentication, saving, and AI processing are not initialized yet.
      </p>
      <a
        className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="/api/health/ready"
      >
        Check API readiness
      </a>
    </section>
  );
}
const rootRoute = createRootRoute({ component: Layout });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});
const foundationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/foundation',
  component: Foundation,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, foundationRoute]),
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
