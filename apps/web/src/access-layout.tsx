import type { ReactNode } from 'react';

export function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <main className="access-layout">
      <div className="access-side">
        <div className="access-mosaic" aria-hidden="true">
          <div className="mosaic-tile mosaic-image" />
          <div className="mosaic-tile">
            <i />
            <i />
            <i />
          </div>
          <div className="mosaic-tile mosaic-link">
            <b />
            <i />
            <i />
          </div>
          <div className="mosaic-tile mosaic-image-blue" />
          <div className="mosaic-tile mosaic-note">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="mosaic-tile mosaic-image-sand" />
          <div className="mosaic-tile">
            <i />
            <i />
          </div>
          <div className="mosaic-tile mosaic-link">
            <b />
            <i />
          </div>
          <div className="mosaic-tile mosaic-image" />
          <div className="mosaic-tile mosaic-note">
            <i />
            <i />
          </div>
          <div className="mosaic-tile mosaic-image-blue" />
          <div className="mosaic-tile">
            <i />
            <i />
          </div>
        </div>
        <div className="access-scrim" aria-hidden="true" />
        <p className="access-quote">
          Everything you saved,
          <br />
          right where you left it.
        </p>
      </div>
      <div className="access-main">
        <div className="access-mark">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M16 29V15"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="sprout-leaf"
              d="M16 17c-1-6-5.5-9-11-8.6C5.2 14 9.6 17.4 16 17Z"
            />
            <path
              d="M16 14c.6-6.2 5-10 11.4-10C27.5 10.4 23 14 16 14Z"
              fill="currentColor"
            />
          </svg>
          Sprout
        </div>
        <section className="access-center">{children}</section>
        <footer className="access-footer">Private · runs on your PC</footer>
      </div>
    </main>
  );
}
