import { useEffect, useRef, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import type { SavedTextItem } from '@sprout/contracts';
import { Button } from '@sprout/ui';
import { LibraryFailure, displayRetentionTime, getText } from './api.js';
import { CopyTextButton } from './copy-text-button.js';

type ItemState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly item: SavedTextItem }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unavailable' };

export function TextInspector({ itemId }: { itemId: string }) {
  const from = useSearch({
    from: '/authenticated/library/items/$itemId',
  }).from;
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<ItemState>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setState({ kind: 'loading' });
    void getText(itemId)
      .then((item) => {
        if (current) setState({ kind: 'ready', item });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setState({
          kind:
            error instanceof LibraryFailure &&
            (error.kind === 'missing' || error.kind === 'invalid')
              ? 'missing'
              : 'unavailable',
        });
      });
    return () => {
      current = false;
    };
  }, [itemId, retry]);
  useEffect(() => {
    if (state.kind === 'ready' || state.kind === 'missing')
      heading.current?.focus();
  }, [state.kind]);

  const searchQuery =
    new URL(from, window.location.origin).searchParams.get('q') ?? '';
  const backToSearch = from.startsWith('/search');

  return (
    <section className="text-inspector" aria-label="Saved item">
      {state.kind === 'ready' ? (
        backToSearch ? (
          <Link
            to="/search"
            search={{ q: searchQuery }}
            className="text-link back-link"
          >
            Back to search
          </Link>
        ) : (
          <Link to="/library" className="text-link back-link">
            Back to Library
          </Link>
        )
      ) : backToSearch ? (
        <Link
          to="/search"
          search={{ q: searchQuery }}
          className="text-link back-link"
        >
          Close item
        </Link>
      ) : (
        <Link to="/library" className="text-link back-link">
          Close item
        </Link>
      )}
      {state.kind === 'loading' ? <p role="status">Opening original…</p> : null}
      {state.kind === 'missing' ? (
        <>
          <h1 ref={heading} tabIndex={-1}>
            Item not found
          </h1>
          <p>This item is unavailable.</p>
        </>
      ) : null}
      {state.kind === 'unavailable' ? (
        <div role="alert" className="collection-message">
          <p>This original is unavailable right now.</p>
          <Button
            variant="outline"
            className="touch-target"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {state.kind === 'ready' ? (
        <>
          <div className="inspector-heading">
            <h1 ref={heading} tabIndex={-1}>
              Original input
            </h1>
            <time dateTime={state.item.retainedAt}>
              {displayRetentionTime(state.item.retainedAt)}
            </time>
          </div>
          <div
            className="original-reading"
            role="region"
            aria-label="Original input"
            dir="auto"
          >
            {state.item.originalText}
          </div>
          <CopyTextButton text={state.item.originalText} />
          {state.item.submittedIntent !== null &&
          state.item.submittedIntent !== '' ? (
            <section className="inspector-intent">
              <h2>Saving intent</h2>
              <p dir="auto">{state.item.submittedIntent}</p>
            </section>
          ) : null}
          <dl className="item-statuses">
            <div>
              <dt>Review</dt>
              <dd>{state.item.review}</dd>
            </div>
            <div>
              <dt>Understanding</dt>
              <dd>{state.item.understanding}</dd>
            </div>
            <div>
              <dt>Actions</dt>
              <dd>{state.item.actions}</dd>
            </div>
          </dl>
          <p className="schedule-notice">
            Not scheduled. Requests in this text are kept only. Nothing is
            scheduled.
          </p>
        </>
      ) : null}
    </section>
  );
}
