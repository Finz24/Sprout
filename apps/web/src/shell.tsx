import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router';
import { Button } from '@sprout/ui';
import { session } from './session.js';

export const useSession = () => useSyncExternalStore(session.subscribe, session.snapshot);

export function AccessStatus() {
  const state = useSession();
  const router = useRouter();
  const retry = () => { void router.invalidate(); };
  return <main className="access-page"><section className="access-card" aria-live="polite">
    <p className="wordmark">Sprout</p>
    <h1>{state.kind === 'LogoutFailed' ? 'Sign out needs a retry' : state.kind === 'Unavailable' ? 'Sprout is unavailable' : 'Checking access…'}</h1>
    {state.kind === 'LogoutFailed' ? <><p>Your private content is hidden. The server has not confirmed sign out.</p><Button className="touch-target" onClick={() => { void session.signOut(); }}>Retry sign out</Button></> : state.kind === 'Unavailable' ? <><p>We could not check your session. Try again when the connection returns.</p><Button className="touch-target" onClick={retry}>Try again</Button></> : <p>Please wait.</p>}
  </section></main>;
}

function Navigation({ close }: { close?: () => void }) {
  return <nav aria-label="Main navigation" className="nav-links">
    <Link to="/library" onClick={close} activeProps={{ 'aria-current': 'page' }}>Library</Link>
    <Link to="/search" search={{ q: '' }} onClick={close} activeProps={{ 'aria-current': 'page' }}>Find and ask</Link>
    <Link to="/spaces" onClick={close} activeProps={{ 'aria-current': 'page' }}>Spaces</Link>
    <Link to="/settings" onClick={close} activeProps={{ 'aria-current': 'page' }}>Settings</Link>
  </nav>;
}

function Drawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { dialog.current?.close(); };
  return <>
    <Button ref={trigger} variant="outline" className="mobile-menu touch-target" aria-haspopup="dialog" onClick={() => { dialog.current?.showModal(); }}>Menu</Button>
    <dialog ref={dialog} className="menu-drawer" aria-label="Navigation" onClose={() => { trigger.current?.focus(); }}>
      <div className="drawer-header"><span className="wordmark">Sprout</span><Button variant="outline" className="touch-target" onClick={close} autoFocus>Close menu</Button></div>
      <Navigation close={close} />
    </dialog>
  </>;
}

function SearchForm() {
  const navigate = useNavigate();
  return <form role="search" className="header-search" onSubmit={(event) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') ?? '').slice(0, 500);
    void navigate({ to: '/search', search: { q } });
  }}><label className="sr-only" htmlFor="header-query">Find and ask</label><input id="header-query" name="q" type="search" placeholder="Find something you kept" maxLength={500} /><Button variant="outline" className="touch-target" type="submit">Search</Button></form>;
}

export function Shell() {
  const state = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (state.kind === 'Anonymous') void navigate({ to: '/login', search: { returnTo: '/library' }, replace: true });
  }, [state.kind, navigate]);
  if (state.kind !== 'Ready') return <AccessStatus />;
  return <div className="app-shell">
    <aside className="sidebar"><Link to="/library" className="wordmark">Sprout</Link><Navigation /><p className="sidebar-note">A place for what you want to keep.</p></aside>
    <div className="workspace"><header className="shell-header"><Drawer /><SearchForm /></header><main id="main-content" className="shell-content"><Outlet /></main></div>
  </div>;
}

export function ViewPreference() {
  const state = useSession();
  const [pending, setPending] = useState(false);
  if (state.kind !== 'Ready') return null;
  return <fieldset className="view-choice" disabled={pending}><legend>Library view</legend>{(['grid', 'list'] as const).map((view) => <Button key={view} className="touch-target" variant={state.shell.libraryView === view ? 'default' : 'outline'} aria-pressed={state.shell.libraryView === view} onClick={() => {
    setPending(true);
    void session.setView(view).finally(() => { setPending(false); });
  }}>{view === 'grid' ? 'Grid' : 'List'}</Button>)}<span role="status">{pending ? 'Saving preference…' : ''}</span></fieldset>;
}

export function Library() {
  return <><div className="page-heading"><div><p className="eyebrow">Your workspace</p><h1>Library</h1></div><ViewPreference /></div><section className="empty-library"><div className="empty-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2"><path d="M24 42V22" strokeLinecap="round"/><path d="M24 27c-7 0-12-4-12-11 7 0 12 4 12 11Z"/><path d="M24 21c0-7 5-11 12-11 0 7-5 11-12 11Z"/></svg></div><h2>Your library is ready for a fresh start</h2><p>There are no saved items yet. Saving will be available in a future update.</p><Link to="/settings" className="text-link">Choose your preferred library view</Link></section><Outlet /></>;
}

export function Settings() {
  const state = useSession();
  if (state.kind !== 'Ready') return null;
  return <section className="settings-page"><p className="eyebrow">Your workspace</p><h1>Settings</h1><section className="settings-section"><h2>Account</h2><p>{state.shell.owner.name}</p><p className="muted">{state.shell.owner.email}</p><Button variant="outline" className="touch-target" onClick={() => { void session.signOut(); }}>Sign out</Button></section><section className="settings-section"><h2>Browsing</h2><p className="muted">Your preference follows this account when you return.</p><ViewPreference /></section></section>;
}

export function Placeholder({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="placeholder-page"><p className="eyebrow">Your workspace</p><h1>{title}</h1><p>{children}</p><Link to="/library" className="text-link">Back to Library</Link></section>;
}

export function Inspector() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="inspector" aria-label="Saved item"><Link to="/library" className="text-link">Close item</Link><h1 ref={heading} tabIndex={-1}>Item not found</h1><p>This item is unavailable.</p></section>;
}
