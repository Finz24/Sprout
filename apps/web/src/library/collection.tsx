import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import type {
  LibraryCursor,
  SavedTextItem,
  SavedTextPage,
} from '@sprout/contracts';
import { Button } from '@sprout/ui';
import { displayRetentionTime, listText, searchText } from './api.js';

type CollectionState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'ready';
      readonly items: readonly SavedTextItem[];
      readonly nextCursor: LibraryCursor | null;
    }
  | {
      readonly kind: 'loading-more';
      readonly items: readonly SavedTextItem[];
      readonly nextCursor: LibraryCursor;
    }
  | {
      readonly kind: 'more-unavailable';
      readonly items: readonly SavedTextItem[];
      readonly nextCursor: LibraryCursor;
    }
  | { readonly kind: 'unavailable' };

function firstPage(query?: string): Promise<SavedTextPage> {
  return query === undefined ? listText() : searchText(query);
}

export function useTextCollection(query?: string) {
  const [state, setState] = useState<CollectionState>({ kind: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestGeneration = useRef(0);
  const currentQuery = useRef(query);
  if (currentQuery.current !== query) {
    currentQuery.current = query;
    requestGeneration.current += 1;
  }
  useEffect(() => {
    const generation = requestGeneration.current;
    let current = true;
    if (query === '') {
      setState({ kind: 'ready', items: [], nextCursor: null });
      return () => {
        current = false;
      };
    }
    setState({ kind: 'loading' });
    void firstPage(query)
      .then((page) => {
        if (current && generation === requestGeneration.current)
          setState({
            kind: 'ready',
            items: page.items,
            nextCursor: page.nextCursor,
          });
      })
      .catch(() => {
        if (current && generation === requestGeneration.current)
          setState({ kind: 'unavailable' });
      });
    return () => {
      current = false;
      if (generation === requestGeneration.current)
        requestGeneration.current += 1;
    };
  }, [query, refreshKey]);

  const reload = () => {
    requestGeneration.current += 1;
    setRefreshKey((key) => key + 1);
  };
  const loadMore = async () => {
    if (state.kind !== 'ready' && state.kind !== 'more-unavailable') return;
    const cursor = state.nextCursor;
    if (cursor === null) return;
    const previous = state;
    const generation = requestGeneration.current;
    setState({
      kind: 'loading-more',
      items: previous.items,
      nextCursor: cursor,
    });
    try {
      const page =
        query === undefined
          ? await listText(cursor)
          : await searchText(query, cursor);
      if (generation !== requestGeneration.current) return;
      setState({
        kind: 'ready',
        items: [...previous.items, ...page.items],
        nextCursor: page.nextCursor,
      });
    } catch {
      if (generation !== requestGeneration.current) return;
      setState({
        kind: 'more-unavailable',
        items: previous.items,
        nextCursor: cursor,
      });
    }
  };
  return { state, reload, loadMore };
}

function SavedCard({
  item,
  from,
  links,
  index,
}: {
  item: SavedTextItem;
  from: string;
  links: boolean;
  index: number;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  return (
    <motion.article
      className="saved-card"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={reducedMotion ? false : { opacity: 1, y: 0 }}
      {...(reducedMotion ? {} : { whileHover: { y: -3 } })}
      transition={{
        duration: 0.34,
        ease: [0.16, 1, 0.3, 1],
        delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.18),
      }}
    >
      <div className="saved-card-meta">
        <span>{item.review}</span>
        <time dateTime={item.retainedAt}>{displayRetentionTime(item.retainedAt)}</time>
      </div>
      <div className="saved-card-content">
        {links ? (
          <Link
            to="/library/items/$itemId"
            params={{ itemId: item.itemId }}
            search={{ from }}
            className="saved-excerpt-link"
          >
            <span className="sr-only">Open Original input: </span>
            <span className="saved-excerpt" dir="auto">{item.originalText}</span>
          </Link>
        ) : (
          <p className="saved-excerpt" dir="auto">{item.originalText}</p>
        )}
      </div>
      {item.submittedIntent !== null && item.submittedIntent !== '' ? (
        <p className="saved-intent">
          <span>Why you kept it</span>
          <span dir="auto">{item.submittedIntent}</span>
        </p>
      ) : null}
      <div className="saved-card-footer">
        <span>{item.understanding}</span>
        <span>{item.actions}</span>
      </div>
      {links ? (
        <Link
          to="/library/items/$itemId"
          params={{ itemId: item.itemId }}
          search={{ from }}
          className="text-link saved-card-open"
        >
          Open Original input
        </Link>
      ) : null}
    </motion.article>
  );
}

export function TextCollection({
  query,
  links = true,
  collection,
}: {
  readonly query?: string;
  readonly links?: boolean;
  readonly collection: ReturnType<typeof useTextCollection>;
}) {
  const { state, loadMore } = collection;
  if (state.kind === 'loading')
    return <p className="collection-status" role="status">Loading saved text…</p>;
  if (state.kind === 'unavailable')
    return (
      <section className="collection-message" role="alert">
        <p>Saved text is unavailable right now.</p>
        <Button variant="outline" className="touch-target" onClick={collection.reload}>
          Try again
        </Button>
      </section>
    );

  const items = state.items;
  const hasNext = state.nextCursor !== null;
  const back = query === undefined ? '/library' : `/search?q=${encodeURIComponent(query)}`;
  if (items.length === 0)
    return (
      <section className="collection-empty">
        <h2>{query === undefined ? 'Your library is growing.' : 'No matching text'}</h2>
        <p>
          {query === undefined
            ? 'The words you save will be kept here.'
            : 'Search looks for this exact text inside originals.'}
        </p>
      </section>
    );

  return (
    <>
      <div className="saved-grid" aria-label={query === undefined ? 'Saved text' : 'Search results'}>
        {items.map((item, index) => (
          <SavedCard key={item.itemId} item={item} from={back} links={links} index={index} />
        ))}
      </div>
      {state.kind === 'more-unavailable' ? (
        <p className="collection-inline-error" role="alert">
          More text could not load. Try again.
        </p>
      ) : null}
      {hasNext ? (
        <Button
          variant="outline"
          className="touch-target load-more"
          disabled={state.kind === 'loading-more'}
          onClick={() => void loadMore()}
        >
          {state.kind === 'loading-more' ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </>
  );
}
