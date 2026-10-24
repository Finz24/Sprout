import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from '@sprout/ui';
import { useTextCollection, TextCollection } from './collection.js';

export function OriginalSearch() {
  const { q } = useSearch({ from: '/search' });
  const navigate = useNavigate({ from: '/search' });
  const collection = useTextCollection(q);
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);
  return (
    <section className="search-page">
      <header className="search-heading">
        <h1>Search original text</h1>
        <p>Find a phrase exactly as it appears in what you saved.</p>
      </header>
      <form
        className="original-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: '/search', search: { q: query.slice(0, 500) } });
        }}
      >
        <label htmlFor="original-search-query">Text in an original</label>
        <input
          id="original-search-query"
          type="search"
          maxLength={500}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search saved text"
        />
        <Button className="touch-target" type="submit">Search</Button>
      </form>
      <p className="search-scope">Search is case-sensitive. Intent and status are not searched.</p>
      {q ? (
        <section className="search-results" aria-label="Search results">
          <TextCollection query={q} collection={collection} />
        </section>
      ) : (
        <p className="search-hint">Enter a phrase to search original text.</p>
      )}
    </section>
  );
}
