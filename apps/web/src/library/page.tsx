import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Button } from '@sprout/ui';
import { useTextCollection, TextCollection } from './collection.js';
import { TextComposer } from './composer.js';
import { ViewPreference } from '../shell.js';

export function LibraryPage() {
  const collection = useTextCollection();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  return (
    <section className="library-page">
      <header className="library-heading">
        <h1>Library</h1>
        <div className="library-heading-actions">
          <ViewPreference />
          {!composerOpen ? (
            <Button
              className="touch-target new-card-button"
              onClick={() => setComposerOpen(true)}
            >
              New card
            </Button>
          ) : null}
        </div>
      </header>
      <div
        className={
          composerOpen ? 'library-workbench is-composing' : 'library-workbench'
        }
      >
        <section
          className="library-collection"
          aria-label="Saved text collection"
        >
          <TextCollection collection={collection} />
        </section>
        {composerOpen ? (
          <TextComposer
            key={composerKey}
            onClose={() => setComposerOpen(false)}
            onRetained={collection.reload}
            onStartNew={() => setComposerKey((key) => key + 1)}
          />
        ) : null}
      </div>
      <Outlet />
    </section>
  );
}
