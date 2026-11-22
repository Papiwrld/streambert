import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import MediaCard from "../components/MediaCard";
import { imgUrl } from "../utils/api";
import { EyeIcon, WatchedIcon, CloseIcon, SearchIcon } from "../components/Icons";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage, STORAGE_KEYS } from "../utils/storage";
import "./browseSurfaces.css";

const LIBRARY_SORT_OPTIONS = [
  { id: "manual", label: "Custom" },
  { id: "title", label: "A–Z" },
  { id: "rating", label: "Top rated" },
  { id: "year", label: "Newest" },
];

const MEDIA_FILTERS = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "tv", label: "Series" },
];

export default function LibraryPage({
  apiKey,
  history,
  inProgress,
  saved,
  progress,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  onRemoveHistory,
  onRemoveContinue,
  onBrowse,
  isSaved,
  onToggleSave,
}) {
  const allItems = useMemo(
    () => [...inProgress, ...saved],
    [inProgress, saved],
  );
  const { ratingsMap, ageLimitSetting } = useRatings(allItems, apiKey);

  const [sort, setSort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => setSort(e.detail);
    window.addEventListener("streambert:library-sort-changed", handler);
    return () =>
      window.removeEventListener("streambert:library-sort-changed", handler);
  }, []);

  const changeSort = (next) => {
    setSort(next);
    storage.set(STORAGE_KEYS.LIBRARY_SORT, next);
    window.dispatchEvent(
      new CustomEvent("streambert:library-sort-changed", { detail: next }),
    );
  };

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) => isRestricted(getRating(item).minAge, ageLimitSetting),
    [getRating, ageLimitSetting],
  );

  const hasAnyItems =
    inProgress.length > 0 || saved.length > 0 || history.length > 0;
  const q = searchQuery.trim().toLowerCase();

  const matchesFilter = useCallback(
    (item) => {
      if (typeFilter !== "all" && (item.media_type || "movie") !== typeFilter) {
        return false;
      }
      if (q) {
        const title = (item.title || item.name || "").toLowerCase();
        if (!title.includes(q)) return false;
      }
      return true;
    },
    [typeFilter, q],
  );

  const filteredInProgress = useMemo(
    () => inProgress.filter(matchesFilter),
    [inProgress, matchesFilter],
  );
  const filteredSaved = useMemo(
    () => saved.filter(matchesFilter),
    [saved, matchesFilter],
  );
  const filteredHistory = useMemo(
    () => history.filter(matchesFilter),
    [history, matchesFilter],
  );

  const isFilteredEmpty =
    hasAnyItems &&
    filteredInProgress.length === 0 &&
    filteredSaved.length === 0 &&
    filteredHistory.length === 0;

  return (
    <div className="fade-in library-page">
      <div className="library-header">
        <h1 className="library-title">Library</h1>
        <div className="library-sub">
          Watch history, progress, and saved titles
        </div>
      </div>

      {hasAnyItems && (
        <div className="library-toolbar">
          <div className="library-filter-pills" role="group" aria-label="Filter by type">
            {MEDIA_FILTERS.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`library-sort-pill${typeFilter === f.id ? " library-sort-pill--active" : ""}`}
                aria-pressed={typeFilter === f.id}
                onClick={() => setTypeFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="library-search">
            <SearchIcon size={14} />
            <input
              ref={searchRef}
              type="search"
              name="libraryFilter"
              aria-label="Filter library"
              className="library-search__input"
              placeholder="Filter library…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="settings-nav__search-clear"
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear filter"
              >
                <CloseIcon size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {filteredInProgress.length > 0 && (
        <div className="library-section">
          <h2 className="library-section-title">
            Continue watching ({filteredInProgress.length})
          </h2>
          <div className="cards-grid">
            {filteredInProgress.map((item) => {
              const pk =
                item.media_type === "tv"
                  ? `tv_${item.id}_s${item.season}e${item.episode}`
                  : `movie_${item.id}`;
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={pk}
                  item={item}
                  onClick={() => onSelect(item)}
                  onResume={!restr ? () => onSelect({ ...item, autoplay: true }) : undefined}
                  progress={progress[pk] || 0}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                  onRemoveFromRow={onRemoveContinue}
                  isSaved={isSaved ? isSaved(item) : false}
                  onToggleSave={onToggleSave}
                />
              );
            })}
          </div>
        </div>
      )}

      {filteredSaved.length > 0 && (
        <div className="library-section">
          <div className="library-section-head">
            <h2 className="library-section-title">
              Watchlist ({filteredSaved.length})
            </h2>
            <div
              className="library-sort-pills"
              role="group"
              aria-label="Sort watchlist"
            >
              {LIBRARY_SORT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className={`library-sort-pill${sort === opt.id ? " library-sort-pill--active" : ""}`}
                  aria-pressed={sort === opt.id}
                  onClick={() => changeSort(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cards-grid">
            {filteredSaved.map((item) => {
              const r = getRating(item);
              const restr = itemRestricted(item);
              return (
                <MediaCard
                  key={`${item.media_type}_${item.id}`}
                  item={item}
                  onClick={() => onSelect(item)}
                  watched={watched}
                  onMarkWatched={onMarkWatched}
                  onMarkUnwatched={onMarkUnwatched}
                  ageRating={r.cert}
                  restricted={restr}
                  isSaved={isSaved ? isSaved(item) : true}
                  onToggleSave={onToggleSave}
                />
              );
            })}
          </div>
        </div>
      )}

      {filteredHistory.length > 0 && (
        <div className="library-section">
          <h2 className="library-section-title">
            Watch history ({filteredHistory.length})
          </h2>
          <div className="history-rows">
            {filteredHistory.map((item) => {
              const pk =
                item.media_type === "tv"
                  ? `tv_${item.id}_s${item.season}e${item.episode}`
                  : `movie_${item.id}`;
              const isWatched = !!watched?.[pk];
              return (
                <div key={`${pk}_${item.watchedAt}`} className="history-row">
                  <button type="button" className="history-row__open" onClick={() => onSelect(item)}>
                    <span className="history-thumb">
                      {item.poster_path && (
                        <img src={imgUrl(item.poster_path, "w92")} alt="" loading="lazy" />
                      )}
                    </span>
                    <span className="history-row__text">
                      <span className="history-row__title">
                        {item.title}
                        {isWatched && <span className="history-row__watched" aria-label="Watched"><WatchedIcon size={16} /></span>}
                      </span>
                      <span className="history-row__meta">
                        {item.media_type === "tv" &&
                          item.season != null &&
                          item.episode != null && (
                            <>
                              {`S${item.season}E${item.episode}`}
                              {item.episodeName ? ` · ${item.episodeName}` : ""}
                              {" · "}
                            </>
                          )}
                        {new Date(item.watchedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <span
                      className={`search-result-type ${item.media_type === "tv" ? "type-tv" : "type-movie"}`}
                    >
                      {item.media_type === "tv" ? "Series" : "Movie"}
                    </span>
                  </button>
                  {onRemoveHistory && (
                    <button
                      type="button"
                      className="history-remove-btn"
                      title="Remove from history"
                      aria-label={`Remove ${item.title} from history`}
                      onClick={(event) => {
                        const row = event.currentTarget.closest(".history-row");
                        const adjacent = row.nextElementSibling || row.previousElementSibling;
                        const target = adjacent?.querySelector(".history-row__open") || searchRef.current;
                        target?.focus({ preventScroll: true });
                        onRemoveHistory(item);
                      }}
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isFilteredEmpty && (
        <div className="empty-state">
          <SearchIcon />
          <h2>No matching items</h2>
          <p>Try clearing the filter or searching for another title.</p>
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            onClick={() => {
              setTypeFilter("all");
              setSearchQuery("");
              searchRef.current?.focus();
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {!hasAnyItems && (
        <div className="empty-state">
          <EyeIcon />
          <h2>Your library is empty</h2>
          <p>
            Watch a title or save it to your watchlist to find it here.
          </p>
          {onBrowse && <button type="button" className="btn btn-primary" onClick={onBrowse}>Browse movies</button>}
        </div>
      )}
    </div>
  );
}
