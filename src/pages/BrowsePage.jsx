import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MediaCard from "../components/MediaCard";
import { WifiOffIcon } from "../components/Icons";
import { getTmdbLanguage, tmdbFetch } from "../utils/api";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import "./browseSurfaces.css";

const SORTS = [
  { id: "popular", label: "Popular", param: "popularity.desc" },
  { id: "top", label: "Top rated", param: "vote_average.desc" },
  { id: "new", label: "Newest", param: null },
];

const ERAS = [
  { id: "all", label: "Any year", gte: null, lte: null },
  { id: "recent", label: "2025 and later", gte: "2025-01-01", lte: null },
  { id: "2020s", label: "2020s", gte: "2020-01-01", lte: "2029-12-31" },
  { id: "2010s", label: "2010s", gte: "2010-01-01", lte: "2019-12-31" },
  { id: "2000s", label: "2000s", gte: "2000-01-01", lte: "2009-12-31" },
  { id: "classic", label: "Before 2000", gte: null, lte: "1999-12-31" },
];
const DEFAULT_FILTERS = { genre: null, sort: "popular", era: "all" };
const INITIAL_RESULTS = { items: [], page: 1, totalPages: 1, status: "loading" };

/**
 * Netflix-style "Movies" / "Series" browse page: genre filter, era filter,
 * sort, and an endlessly loading poster grid backed by TMDB /discover.
 */
export default function BrowsePage({
  type, // "movie" | "tv"
  apiKey,
  offline,
  snapshot,
  onOpenSettings,
  ...cardProps
}) {
  const [genres, setGenres] = useState(() => snapshot?.genres ?? []);
  const [filters, setFilters] = useState(() => snapshot?.filters ?? DEFAULT_FILTERS);
  const { genre, sort, era } = filters;
  const title = type === "tv" ? "Series" : "Movies";
  const hasFilters = genre !== null || era !== "all" || sort !== "popular";
  const resultsKey = `${type}:${genre}:${sort}:${era}:${getTmdbLanguage()}`;

  const changeFilter = (name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
  };
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  useLayoutEffect(() => {
    if (snapshot) Object.assign(snapshot, { filters, genres });
  }, [snapshot, filters, genres]);

  // Genre list
  useEffect(() => {
    if (!apiKey || offline) return;
    let active = true;
    tmdbFetch(`/genre/${type}/list`, apiKey)
      .then((data) => active && setGenres(data?.genres || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [type, apiKey, offline]);

  return (
    <div className="fade-in browse">
      <header className="browse-header">
        <h1 className="browse-title">{title}</h1>
        {apiKey && !offline && (
          <div className="browse-controls">
            <select
              className="browse-era-select"
              aria-label="Release year"
              value={era}
              onChange={(e) => changeFilter("era", e.target.value)}
            >
              {ERAS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="browse-sort" role="group" aria-label="Sort by">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sort === s.id}
                  className={`browse-sort__btn${sort === s.id ? " is-active" : ""}`}
                  onClick={() => changeFilter("sort", s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {apiKey && !offline && (
        <div className="browse-genres" role="group" aria-label="Genre">
          <button
            type="button"
            className={`chip${genre == null ? " is-active" : ""}`}
            onClick={() => changeFilter("genre", null)}
            aria-pressed={genre == null}
          >
            All genres
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`chip${genre === g.id ? " is-active" : ""}`}
              onClick={() => changeFilter("genre", g.id)}
              aria-pressed={genre === g.id}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {!apiKey ? (
        <div className="empty-state">
          <h2>Connect TMDB</h2>
          <p>Add your TMDB token in Settings to browse {title.toLowerCase()}.</p>
          {onOpenSettings && (
            <button className="btn btn-primary" onClick={onOpenSettings}>
              Open settings
            </button>
          )}
        </div>
      ) : offline ? (
        <div className="empty-state">
          <WifiOffIcon />
          <h2>You're offline</h2>
          <p>Reconnect to browse {title.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          {hasFilters && (
            <button type="button" className="browse-reset-btn browse-clear" onClick={resetFilters}>
              Clear filters
            </button>
          )}
          <BrowseResults
            key={resultsKey}
            resultsKey={resultsKey}
            snapshot={snapshot}
            type={type}
            title={title.toLowerCase()}
            apiKey={apiKey}
            genre={genre}
            era={era}
            sort={sort}
            hasFilters={hasFilters}
            {...cardProps}
          />
        </>
      )}
    </div>
  );
}

function discoverPath(type, genre, sort, era, page) {
  const dateField = type === "tv" ? "first_air_date" : "primary_release_date";
  const params = new URLSearchParams({ page: String(page), include_adult: "false" });
  if (genre) params.set("with_genres", String(genre));

  const { gte, lte } = ERAS.find((option) => option.id === era);
  if (gte) params.set(`${dateField}.gte`, gte);
  if (lte) params.set(`${dateField}.lte`, lte);
  if (sort === "new") {
    const today = new Date().toISOString().slice(0, 10);
    params.set("sort_by", `${dateField}.desc`);
    if (!lte || lte > today) params.set(`${dateField}.lte`, today);
    params.set("vote_count.gte", "20");
  } else {
    params.set("sort_by", SORTS.find((option) => option.id === sort).param);
    if (sort === "top") params.set("vote_count.gte", "300");
  }
  return `/discover/${type}?${params.toString()}`;
}

function BrowseResults({
  type, title, apiKey, genre, sort, era, hasFilters, onSelect, watched,
  onMarkWatched, onMarkUnwatched, isSaved, onToggleSave, snapshot, resultsKey,
}) {
  const [results, setResults] = useState(() => {
    const cached = snapshot?.results;
    return cached?.key === resultsKey && cached.apiKey === apiKey
      ? cached.value
      : INITIAL_RESULTS;
  });
  const { items, page, totalPages, status } = results;
  const sentinelRef = useRef(null);

  useLayoutEffect(() => {
    if (snapshot) snapshot.results = { key: resultsKey, apiKey, value: results };
  }, [snapshot, resultsKey, apiKey, results]);

  useEffect(() => {
    if (status !== "loading") return;
    let active = true;
    tmdbFetch(discoverPath(type, genre, sort, era, page), apiKey)
      .then((data) => {
        if (!active) return;
        setResults(({ items: previousItems }) => {
          const unique = new Map(previousItems.map((item) => [item.id, item]));
          for (const item of data?.results || []) {
            if (item.poster_path && !unique.has(item.id)) {
              unique.set(item.id, { ...item, media_type: type });
            }
          }
          return {
            items: [...unique.values()],
            page,
            totalPages: Math.min(data?.total_pages || 1, 500),
            status: "ready",
          };
        });
      })
      .catch(() => {
        if (active) setResults((previous) => ({ ...previous, status: "error" }));
      });
    return () => {
      active = false;
    };
  }, [apiKey, type, genre, sort, era, page, status]);

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    setResults((previous) => {
      if (previous.status !== "ready" || previous.page >= previous.totalPages) return previous;
      return { ...previous, page: previous.page + 1, status: "loading" };
    });
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (status !== "ready" || !hasMore || !sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      loadMore();
    }, { root: sentinel.closest(".main"), rootMargin: "480px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, hasMore, loadMore]);

  const { ratingsMap, ageLimitSetting } = useRatings(items, apiKey);
  const visibleItems = useMemo(() => items.filter((item) =>
    !isRestricted(getRatingForItem(item, ratingsMap).minAge, ageLimitSetting),
  ), [items, ratingsMap, ageLimitSetting]);

  return (
    <section className="section" aria-label={`${title} results`}>
      <div className="cards-grid" aria-busy={status === "loading"}>
        {visibleItems.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onClick={() => onSelect(item)}
            onPlay={() => onSelect({ ...item, autoplay: true })}
            watched={watched}
            onMarkWatched={onMarkWatched}
            onMarkUnwatched={onMarkUnwatched}
            ageRating={getRatingForItem(item, ratingsMap).cert}
            isSaved={isSaved?.(item)}
            onToggleSave={onToggleSave}
          />
        ))}
        {status === "loading" && Array.from({ length: page === 1 ? 12 : 6 }, (_, index) => (
          <div className="card skeleton-card" key={`skeleton${index}`} aria-hidden="true">
            <div className="card-poster" />
            <div className="skeleton skeleton-line" />
          </div>
        ))}
      </div>
      <div role="status" className="browse-results-status">
        {status === "loading" ? `Loading ${page === 1 ? "" : "more "}${title}…` : ""}
      </div>
      {status === "error" && (
        <div className="empty-state">
          <h2>Couldn't load {page === 1 ? title : `more ${title}`}</h2>
          <button className="btn btn-secondary" onClick={() => {
            setResults((previous) => ({ ...previous, status: "loading" }));
          }}>Try again</button>
        </div>
      )}
      {status === "ready" && !hasMore && visibleItems.length === 0 && (
        <div className="empty-state">
          <h2>{hasFilters ? `No matching ${title}` : `No ${title} to show`}</h2>
          {hasFilters && <p>Try a different genre or release year, or clear your filters.</p>}
        </div>
      )}
      {status === "ready" && hasMore && (
        <div className="browse-load-more" ref={sentinelRef}>
          <button className="btn btn-secondary" onClick={loadMore}>Load more</button>
        </div>
      )}
    </section>
  );
}
