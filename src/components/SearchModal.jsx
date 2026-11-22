import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tmdbFetch } from "../utils/api";
import MediaCard from "./MediaCard";
import { SearchIcon, CloseIcon } from "./Icons";
import { storage } from "../utils/storage";
import { useModal } from "../utils/useModal";

const HISTORY_KEY = "searchHistory";
const MAX_HISTORY = 12;
const EMPTY_RESULTS = [];

function loadHistory() {
  return storage.get(HISTORY_KEY) || [];
}

function saveHistory(history) {
  storage.set(HISTORY_KEY, history);
}

export default function SearchModal({
  apiKey,
  onSelect,
  onClose,
  offline,
  onOpenSettings,
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef();
  const { dialogProps, backdropProps } = useModal(onClose);
  const term = query.trim();
  const request = useMemo(
    () => apiKey && !offline && term ? { apiKey, term, attempt } : null,
    [apiKey, offline, term, attempt],
  );
  const currentResponse = request && response?.request === request ? response : null;
  const loading = !!request && !currentResponse;
  const results = currentResponse?.results ?? EMPTY_RESULTS;

  useEffect(() => {
    setHistoryIndex(-1);
  }, [query, history.length]);

  useEffect(() => {
    if (!request) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await tmdbFetch(
          `/search/multi?query=${encodeURIComponent(request.term)}&page=1`,
          request.apiKey,
        );
        if (active) {
          const matches = (data.results || [])
            .filter((r) => r.media_type === "movie" || r.media_type === "tv")
            .slice(0, 20);
          setResponse({ request, results: matches });
        }
      } catch {
        if (active) setResponse({ request, error: true });
      }
    }, 380);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [request]);

  const addToHistory = useCallback((term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const removeFromHistory = useCallback((term) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleSelect = (r) => {
    const trimmed = query.trim();
    if (trimmed) {
      const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      setHistory(next);
    }
    onSelect(r);
    onClose();
  };

  const handleHistoryClick = useCallback((term) => {
    setQuery(term);
    inputRef.current?.focus();
  }, []);

  const showHistory = !term && history.length > 0 && !!apiKey && !offline;

  const handleKey = (e) => {
    if (showHistory) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistoryIndex((i) => Math.min(i + 1, history.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistoryIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && historyIndex >= 0 && history[historyIndex]) {
        e.preventDefault();
        handleHistoryClick(history[historyIndex]);
        return;
      }
    }
    if (e.key === "Enter" && query.trim()) addToHistory(query);
  };

  const movieCount = useMemo(
    () => results.filter((r) => r.media_type === "movie").length,
    [results],
  );
  const tvCount = useMemo(
    () => results.filter((r) => r.media_type === "tv").length,
    [results],
  );
  const filteredResults = useMemo(() => {
    if (typeFilter === "all") return results;
    return results.filter((r) => r.media_type === typeFilter);
  }, [results, typeFilter]);

  return (
    <div className="modal-overlay" {...backdropProps}>
      <div
        className="search-box"
        {...dialogProps}
        aria-label="Search"
      >
        <div className="search-input-wrap">
          <SearchIcon />
          <input
            ref={inputRef}
            data-modal-initial-focus
            className="search-input"
            placeholder="Movies, series, anime"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button
              type="button"
              className="icon-action"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <CloseIcon />
            </button>
          )}
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {request && (
          <div className="search-filters" role="group" aria-label="Media type">
            {[
              { id: "all", label: "All", count: results.length },
              { id: "movie", label: "Movies", count: movieCount },
              { id: "tv", label: "Series", count: tvCount },
            ].map((f) => (
              <button
                type="button"
                aria-pressed={typeFilter === f.id}
                key={f.id}
                className={`search-filter-pill${typeFilter === f.id ? " search-filter-pill--active" : ""}`}
                onClick={() => setTypeFilter(f.id)}
              >
                {currentResponse?.results ? `${f.label} (${f.count})` : f.label}
              </button>
            ))}
          </div>
        )}

        <div className="search-results" aria-busy={loading}>
          {!apiKey && (
            <div className="empty-state" style={{ padding: "40px 24px" }}>
              <h3>Add a TMDB token to search</h3>
              <p>Search needs your free TMDB Read Access Token.</p>
              {onOpenSettings && (
                <button
                  type="button"
                  className="btn btn-primary btn--sm"
                  style={{ marginTop: 8 }}
                  onClick={onOpenSettings}
                >
                  Open settings
                </button>
              )}
            </div>
          )}
          {apiKey && offline && (
            <div className="search-notice">
              You're offline. Search needs a connection.
            </div>
          )}
          {loading && (
            <div className="search-grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <div className="card skeleton-card" key={i}>
                  <div className="card-poster" />
                  <div className="skeleton skeleton-line" />
                </div>
              ))}
            </div>
          )}
          {currentResponse?.error && (
            <div className="search-empty">
              <p role="alert">Couldn't load search results.</p>
              <button
                className="btn btn-secondary btn--sm"
                type="button"
                onClick={() => {
                  inputRef.current?.focus();
                  setAttempt((count) => count + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}
          {currentResponse?.results && filteredResults.length === 0 && (
            <div className="search-empty">
              {results.length > 0
                ? `No ${typeFilter === "tv" ? "series" : "movies"} match “${query}”`
                : `No results for “${query}”`}
            </div>
          )}
          {filteredResults.length > 0 && (
            <div className="search-grid">
              {filteredResults.map((r) => (
                <MediaCard
                  key={`${r.media_type}_${r.id}`}
                  item={r}
                  onClick={() => handleSelect(r)}
                />
              ))}
            </div>
          )}
          {showHistory && (
            <div className="search-history">
              <div className="search-history-header">
                <span className="search-history-label">Recent searches</span>
                <button className="search-history-clear" onClick={clearHistory}>
                  Clear all
                </button>
              </div>
              {history.map((term, idx) => (
                <div
                  key={term}
                  className={`search-history-item${idx === historyIndex ? " search-history-item--active" : ""}`}
                >
                  <button
                    type="button"
                    className="search-history-select"
                    onClick={() => handleHistoryClick(term)}
                  >
                    <span className="search-history-icon">
                      <SearchIcon />
                    </span>
                    <span className="search-history-term">{term}</span>
                  </button>
                  <button
                    type="button"
                    className="search-history-remove"
                    onClick={() => removeFromHistory(term)}
                    title="Remove"
                    aria-label={`Remove ${term}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {apiKey && !offline && !term && history.length === 0 && (
            <div className="search-hint">
              Search for movies and series &nbsp;·&nbsp; <kbd>Esc</kbd> to close
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
