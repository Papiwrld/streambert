import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import MediaCard from "../components/MediaCard";
import MediaRow, { HomeSkeleton } from "../components/MediaRow";
import TitleArt from "../components/TitleArt";
import HeroTrailer from "../components/HeroTrailer";
import {
  PlayIcon,
  StarIcon,
  InfoIcon,
  WifiOffIcon,
  BookmarkIcon,
  BookmarkFillIcon,
} from "../components/Icons";
import { imgUrl, tmdbFetch } from "../utils/api";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { storage } from "../utils/storage";
import { getThumbs } from "../utils/thumbs";
import { loadHomeLayout, loadHomeViewMode } from "../utils/homeLayout";
import "./browseSurfaces.css";

/**
 * Extract up to `count` unique, recently watched items from the user's
 * history (within the last 30 days).  Returns newest-first and dedupes
 * by TMDB id + media_type so we don't fire duplicate API calls.
 */
function getRecentHistoryItems(history, count = 5) {
  if (!history || history.length === 0) return [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = history
    .filter((h) => h.watchedAt && h.watchedAt > thirtyDaysAgo)
    .sort((a, b) => b.watchedAt - a.watchedAt);

  const seen = new Set();
  const unique = [];
  for (const item of recent) {
    const key = `${item.media_type || "movie"}_${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= count) break;
  }
  return unique;
}

const PERSONAL_SWAP_MS = 2000;

export default function HomePage({
  trending,
  trendingTV,
  loading,
  onSelect,
  progress,
  inProgress,
  offline,
  onRetry,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  history,
  apiKey,
  savedList = [],
  isSaved,
  onToggleSave,
  onRemoveContinue,
  onOpenSettings,
}) {
  const heroRef = useRef(null);
  const [recsReady, setRecsReady] = useState(
    () => !apiKey || !history || history.length === 0,
  );
  const [heroPick, setHeroPick] = useState(null);
  const [top10Items, setTop10Items] = useState([]);
  const [ambient, setAmbient] = useState(null);

  const [recommendedItems, setRecommendedItems] = useState([]);
  const [topRatedItems, setTopRatedItems] = useState([]);

  // Load layout config (order + visibility) once on mount
  const [layout] = useState(() => loadHomeLayout());
  const { order: rowOrder, visible: rowVisible } = layout;

  const [viewMode] = useState(() => loadHomeViewMode());

  // All items for batch ratings fetch
  const allItems = useMemo(
    () => [
      ...inProgress,
      ...trending.map((i) => ({ ...i, media_type: "movie" })),
      ...trendingTV.map((i) => ({ ...i, media_type: "tv" })),
      ...recommendedItems,
      ...topRatedItems,
      ...top10Items,
      ...savedList,
    ],
    [
      inProgress,
      trending,
      trendingTV,
      recommendedItems,
      topRatedItems,
      top10Items,
      savedList,
    ],
  );

  const { ratingsMap, ageLimitSetting } = useRatings(allItems, offline ? null : apiKey);

  const getRating = useCallback(
    (item) => getRatingForItem(item, ratingsMap),
    [ratingsMap],
  );
  const itemRestricted = useCallback(
    (item) =>
      isRestricted(getRatingForItem(item, ratingsMap).minAge, ageLimitSetting),
    [ratingsMap, ageLimitSetting],
  );

  const hero = !offline && apiKey && heroPick && !itemRestricted(heroPick) ? heroPick : null;
  const heroType = hero?.media_type === "tv" ? "tv" : "movie";

  // Average colour of the hero backdrop, used to tint the page behind the rows
  const heroBackdrop = hero?.backdrop_path;
  useEffect(() => {
    setAmbient(null);
    if (!heroBackdrop) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 8;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        if (alive) setAmbient(`rgb(${(r / n) | 0} ${(g / n) | 0} ${(b / n) | 0})`);
      } catch {
        /* tainted canvas: keep the neutral background */
      }
    };
    img.src = imgUrl(heroBackdrop, "w300");
    return () => {
      alive = false;
    };
  }, [heroBackdrop]);

  // Hero: shown as soon as discovery data arrives so Home is never blank.
  // If that first pick had to come from trending because recommendations
  // were still loading, it's upgraded to a personal pick when they land,
  // as long as that happens within PERSONAL_SWAP_MS (before the trailer
  // starts). Only settled picks are pinned for the session.
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    if (!apiKey || offline) return;
    const upgrade =
      hero &&
      hero.provisional &&
      recsReady &&
      recommendedItems.length > 0 &&
      Date.now() - mountedAt.current < PERSONAL_SWAP_MS;
    if (hero && !upgrade) return;
    if (!hero && !recsReady && !trending.length && !trendingTV.length) return;

    const key = (i) => `${i.media_type}_${i.id}`;
    const watchedKeys = new Set(
      (history || []).map((h) => `${h.media_type || "movie"}_${h.id}`),
    );
    const usable = (i) =>
      i.backdrop_path &&
      i.overview &&
      !watchedKeys.has(key(i)) &&
      !disliked.has(key(i)) &&
      !itemRestricted(i);
    const trend = [
      ...trending.map((i) => ({ ...i, media_type: "movie" })),
      ...trendingTV.map((i) => ({ ...i, media_type: "tv" })),
    ];
    // Interleave recommended (personal) and trending so both get a turn;
    // an upgrade only considers the personal ones.
    const pool = [];
    for (let i = 0; i < Math.max(recommendedItems.length, trend.length); i++) {
      if (recommendedItems[i]) pool.push(recommendedItems[i]);
      if (trend[i] && !upgrade) pool.push(trend[i]);
    }
    const seenIds = new Set();
    const candidates = pool.filter((i) => {
      if (!usable(i) || seenIds.has(key(i))) return false;
      seenIds.add(key(i));
      return true;
    });
    if (candidates.length === 0) {
      if (upgrade) return;
      const fallback = trend.find((item) => item.backdrop_path && !itemRestricted(item));
      if (fallback) setHeroPick({ ...fallback, provisional: !recsReady });
      return;
    }
    // Same pick for the whole session unless the user has watched something new
    const lastWatchedAt = history?.[0]?.watchedAt;
    const session = window.__lumenHero;
    let pick = session && session.lastWatchedAt === lastWatchedAt
      ? candidates.find((c) => key(c) === session.key)
      : null;
    if (!pick) {
      const recent = storage.get("heroSeen") || [];
      pick = candidates.find((c) => !recent.includes(key(c))) || candidates[0];
      if (recsReady) {
        storage.set("heroSeen", [key(pick), ...recent].slice(0, 12));
        window.__lumenHero = { lastWatchedAt, key: key(pick) };
      }
    }
    setHeroPick({
      ...pick,
      recommended: recommendedItems.some((item) => key(item) === key(pick)),
      provisional: !recsReady,
    });
  }, [hero, apiKey, offline, recsReady, trending, trendingTV, recommendedItems, history, itemRestricted]);

  // Enrich ratingsMap with restricted flag for carousels
  const enrichedRatingsMap = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(ratingsMap)) {
      out[k] = { ...v, restricted: isRestricted(v.minAge, ageLimitSetting) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingsMap, ageLimitSetting]);

  // Filter recommended items that exceed age limit setting
  const filteredRecommendedItems = useMemo(() => {
    return recommendedItems.filter((item) => !itemRestricted(item));
  }, [recommendedItems, itemRestricted]);

  // Only the titles recommendations are built from; reordering history or
  // replaying the same title doesn't refetch.
  // Thumbs ratings: read on mount (Home remounts whenever you come back to it)
  const [thumbs] = useState(getThumbs);
  const disliked = useMemo(
    () => new Set(Object.keys(thumbs).filter((k) => thumbs[k] < 0)),
    [thumbs],
  );
  // Sources for recommendations: up to two liked titles, then recent
  // watches, never anything rated thumbs down.
  const recSources = useMemo(() => {
    const liked = Object.keys(thumbs)
      .filter((k) => thumbs[k] > 0)
      .slice(-2)
      .map((k) => {
        const [type, id] = k.split("_");
        return { id: Number(id), media_type: type };
      });
    const out = [];
    const seen = new Set();
    for (const h of [...liked, ...getRecentHistoryItems(history, 5)]) {
      const k = `${h.media_type || "movie"}_${h.id}`;
      if (seen.has(k) || disliked.has(k)) continue;
      seen.add(k);
      out.push(h);
      if (out.length >= 5) break;
    }
    return out;
  }, [thumbs, disliked, history]);
  const recSourceKey = recSources
    .map((h) => `${h.media_type || "movie"}_${h.id}`)
    .join(",");

  // Fetch personalised recommendations from multiple recent history items
  useEffect(() => {
    const sources = recSources;
    if (!apiKey || offline || !sources.length) {
      setRecsReady(true);
      return;
    }
    const fallback = setTimeout(() => setRecsReady(true), 3000);
    let active = true;

    // Build a Set of already-watched TMDB ids for dedup
    const watchedIds = new Set(
      (history || []).map((h) => `${h.media_type || "movie"}_${h.id}`),
    );

    // For each source, try /recommendations first, fall back to /similar
    const fetches = sources.map((source) => {
      const type = source.media_type === "tv" ? "tv" : "movie";
      return tmdbFetch(`/${type}/${source.id}/recommendations`, apiKey)
        .then((data) => {
          if (!active) return [];
          const results = (data.results || []).map((i) => ({
            ...i,
            media_type: type,
          }));
          if (results.length > 0) return results;
          // Fall back to /similar if /recommendations returned nothing
          return tmdbFetch(`/${type}/${source.id}/similar`, apiKey).then((d) =>
            (d.results || []).map((i) => ({ ...i, media_type: type })),
          );
        })
        .catch(() => []);
    });

    Promise.all(fetches)
      .then((arrays) => {
        if (!active) return;
        // Interleave results from each source for variety
        const merged = [];
        const maxLen = Math.max(...arrays.map((a) => a.length));
        for (let i = 0; i < maxLen; i++) {
          for (const arr of arrays) {
            if (arr[i]) merged.push(arr[i]);
          }
        }

        // Deduplicate and filter out already-watched items
        const seen = new Set();
        const deduped = merged.filter((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (seen.has(key) || watchedIds.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRecommendedItems(
          deduped
            .filter((item) => !disliked.has(`${item.media_type}_${item.id}`))
            .slice(0, 20),
        );
        setRecsReady(true);
      })
      .catch((e) => {
        if (active) setRecsReady(true);
      });

    return () => {
      clearTimeout(fallback);
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, offline, recSourceKey]);

  // Top 10 today across movies and series
  useEffect(() => {
    if (!apiKey || offline) return;
    let alive = true;
    tmdbFetch("/trending/all/day", apiKey)
      .then((d) => {
        if (!alive) return;
        setTop10Items(
          (d?.results || [])
            .filter(
              (r) =>
                (r.media_type === "movie" || r.media_type === "tv") &&
                r.poster_path,
            )
            .slice(0, 10),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [apiKey, offline]);

  // Fetch top rated movies + TV, merge and shuffle
  useEffect(() => {
    if (!apiKey || offline) return;
    const controller = new AbortController();
    Promise.all([
      tmdbFetch("/movie/top_rated?page=1", apiKey, {
        signal: controller.signal,
      }),
      tmdbFetch("/tv/top_rated?page=1", apiKey, { signal: controller.signal }),
    ])
      .then(([moviesData, tvData]) => {
        const movies = (moviesData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "movie" }));
        const tv = (tvData.results || [])
          .slice(0, 8)
          .map((i) => ({ ...i, media_type: "tv" }));
        // Interleave movies and TV for variety
        const merged = [];
        const max = Math.max(movies.length, tv.length);
        for (let i = 0; i < max; i++) {
          if (movies[i]) merged.push(movies[i]);
          if (tv[i]) merged.push(tv[i]);
        }
        setTopRatedItems(merged);
      })
      .catch((e) => {
        if (e.name !== "AbortError") console.warn("Top rated fetch failed", e);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, offline]);

  // Recently watched: latest entry per title (movies and whole series), newest
  // first, including finished ones. Skips what Continue watching already shows.
  const recentItems = useMemo(() => {
    const inRow = new Set(inProgress.map((i) => `${i.media_type}_${i.id}`));
    const seen = new Set();
    const out = [];
    for (const h of [...(history || [])].sort((a, b) => b.watchedAt - a.watchedAt)) {
      const type = h.media_type === "tv" ? "tv" : "movie";
      const k = `${type}_${h.id}`;
      if (seen.has(k) || (rowVisible.continue && inRow.has(k))) continue;
      seen.add(k);
      out.push({
        id: h.id,
        title: type === "movie" ? h.title : undefined,
        name: type === "tv" ? h.title : undefined,
        poster_path: h.poster_path,
        media_type: type,
      });
      if (out.length >= 20) break;
    }
    return out;
  }, [history, inProgress, rowVisible.continue]);

  // Stable pre-built item arrays for carousels, capped at 10
  const trendingMovieItems = useMemo(
    () => trending.slice(0, 10).map((i) => ({ ...i, media_type: "movie" })),
    [trending],
  );
  const trendingTVItems = useMemo(
    () => trendingTV.slice(0, 10).map((i) => ({ ...i, media_type: "tv" })),
    [trendingTV],
  );

  // Shared per-card props for rows and grids
  const cardProps = useCallback(
    (item) => {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const rd = enrichedRatingsMap[`${type}_${item.id}`] || {};
      return {
        progress: 0,
        watched,
        onMarkWatched,
        onMarkUnwatched,
        ageRating: rd.cert,
        restricted: rd.restricted,
        isSaved: isSaved ? isSaved(item) : false,
        onToggleSave,
      };
    },
    [enrichedRatingsMap, watched, onMarkWatched, onMarkUnwatched, isSaved, onToggleSave],
  );

  const continueProps = useCallback(
    (item) => {
      const pk =
        item.media_type === "movie"
          ? `movie_${item.id}`
          : `tv_${item.id}_s${item.season}e${item.episode}`;
      const r = getRating(item);
      return {
        progress: progress[pk] || 0,
        watched,
        onMarkWatched,
        onMarkUnwatched,
        ageRating: r.cert,
        restricted: itemRestricted(item),
        onRemoveFromRow: onRemoveContinue,
        onResume: offline ? undefined : () => onSelect({ ...item, autoplay: true }),
        isSaved: isSaved ? isSaved(item) : false,
        onToggleSave,
      };
    },
    [
      getRating,
      itemRestricted,
      progress,
      watched,
      onMarkWatched,
      onMarkUnwatched,
      onRemoveContinue,
      offline,
      onSelect,
      isSaved,
      onToggleSave,
    ],
  );

  // Rows render as horizontal scrollers by default, or as a grid in list mode
  const renderRow = (key, title, items, propsFor = cardProps, ranked = false) => {
    if (!items || items.length === 0) return null;
    if (viewMode === "list") {
      return (
        <section key={key} className="section" aria-label={title}>
          <h2 className="section-title">{title}</h2>
          <div className="cards-grid">
            {items.map((item) => (
              <MediaCard
                key={`${item.media_type}_${item.id}_${item.season ?? ""}_${item.episode ?? ""}`}
                item={item}
                onClick={() => onSelect(item)}
                onPlay={apiKey && !offline ? () => onSelect({ ...item, autoplay: true }) : undefined}
                {...propsFor(item)}
              />
            ))}
          </div>
        </section>
      );
    }
    return (
      <MediaRow
        key={key}
        title={title}
        items={items}
        onSelect={onSelect}
        getCardProps={propsFor}
        apiKey={offline ? undefined : apiKey}
        ranked={ranked}
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    );
  };

  const visibleTop10 = top10Items.filter((item) => !itemRestricted(item));
  const visibleTrendingMovies = trendingMovieItems.filter((item) => !itemRestricted(item));
  const visibleTrendingTV = trendingTVItems.filter((item) => !itemRestricted(item));
  const visibleTopRated = topRatedItems.filter((item) => !itemRestricted(item));

  const rowContent = {
    continue: () =>
      renderRow("continue", "Continue watching", inProgress, continueProps),
    recent: () => renderRow("recent", "Recently watched", recentItems),
    top10: () =>
      renderRow(
        "top10",
        "Top 10 today",
        visibleTop10,
        cardProps,
        true,
      ),
    myList: () => renderRow("myList", "My list", savedList),
    recommended: () =>
      renderRow("recommended", "Recommended for you", filteredRecommendedItems),
    trendingMovies: () =>
      renderRow("trendingMovies", "Trending movies", visibleTrendingMovies),
    trendingTV: () => renderRow("trendingTV", "Trending series", visibleTrendingTV),
    topRated: () => renderRow("topRated", "Top rated", visibleTopRated),
  };

  const heroYear = (hero?.release_date || hero?.first_air_date || "").slice(0, 4);
  const hasDiscovery = !!(apiKey && (hero || visibleTrendingMovies.length || visibleTrendingTV.length ||
    visibleTop10.length || visibleTopRated.length || filteredRecommendedItems.length));
  const localRows = ["continue", "recent", "myList"];

  return (
    <div
      className="fade-in home"
      style={ambient ? { "--ambient": ambient } : undefined}
    >
      {offline && (
        <div className="empty-state home-status">
          <WifiOffIcon />
          <h2>You're offline</h2>
          <p>
            Browsing and search need a connection. Downloads and your library
            still work.
          </p>
        </div>
      )}

      {!offline && loading && !hasDiscovery && <HomeSkeleton />}
      {/* Hold the hero's space while recommendations decide what it shows */}
      {!hero && apiKey && !offline && !recsReady && hasDiscovery && (
        <div className="hero skeleton" aria-hidden="true" />
      )}

      {hero && (
        <header className="hero" ref={heroRef}>
          <div
            key={`${heroType}_${hero.id}`}
            className="hero-bg"
            aria-hidden="true"
            style={{
              backgroundImage: `url(${imgUrl(hero.backdrop_path, "w1280")})`,
            }}
          />
          <HeroTrailer
            movieId={hero.id}
            type={heroType}
            apiKey={apiKey}
            containerRef={heroRef}
          />
          <div className="hero-gradient" />
          <div className="hero-content">
            <div className="hero-type">
              {hero.recommended
                ? "Recommended for you"
                : "Trending now"}
            </div>
            <TitleArt
              type={heroType}
              id={hero.id}
              apiKey={apiKey}
              title={hero.title || hero.name}
              className="hero-title"
              size="w780"
            />
            <div className="hero-meta">
              {hero.vote_average > 0 && (
                <span className="hero-rating">
                  <StarIcon /> {hero.vote_average.toFixed(1)}
                </span>
              )}
              {heroYear && <span>{heroYear}</span>}
              <span>{heroType === "tv" ? "Series" : "Movie"}</span>
            </div>
            <p className="hero-overview">{hero.overview}</p>
            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => onSelect({ ...hero, autoplay: true })}
              >
                <PlayIcon /> Play
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onSelect(hero)}
              >
                <InfoIcon /> More info
              </button>
              {onToggleSave && (
                <button
                  type="button"
                  className={`icon-action${isSaved?.(hero) ? " is-on" : ""}`}
                  onClick={() => onToggleSave(hero)}
                  aria-label={
                    isSaved?.(hero)
                      ? "Remove from watchlist"
                      : "Add to watchlist"
                  }
                  aria-pressed={!!isSaved?.(hero)}
                  title={
                    isSaved?.(hero) ? "In watchlist" : "Add to watchlist"
                  }
                >
                  {isSaved?.(hero) ? <BookmarkFillIcon /> : <BookmarkIcon />}
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {!offline && !loading && recsReady && !hasDiscovery && (
        <div className="empty-state home-status">
          <h2>{apiKey ? "Discovery is unavailable" : "Connect TMDB"}</h2>
          <p>{apiKey ? "Try again to load movies and series." : "Add your TMDB token in Settings to load movies and series."}</p>
          {apiKey && onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}
          {!apiKey && onOpenSettings && (
            <button className="btn btn-primary" onClick={onOpenSettings}>
              Open settings
            </button>
          )}
        </div>
      )}

      <div className="home-rows">
        {rowOrder.map((id) =>
          rowVisible[id] && rowContent[id] && (localRows.includes(id) || (apiKey && !offline)) ? rowContent[id]() : null,
        )}
      </div>
    </div>
  );
}
