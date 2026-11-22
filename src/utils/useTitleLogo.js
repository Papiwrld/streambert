import { useEffect, useState } from "react";
import { tmdbFetch, getTmdbLanguage } from "./api";

// Per-session memo so rows, previews and heroes share one lookup per title.
const _logoCache = new Map(); // "movie_123" → file_path | null

function pickLogo(logos, lang) {
  if (!logos || logos.length === 0) return null;
  const byLang = (l) => logos.filter((x) => x.iso_639_1 === l);
  const ranked = [...byLang(lang), ...byLang("en"), ...byLang(null)];
  const pool = ranked.length ? ranked : logos;
  // Prefer wide, high-vote marks; they read best over a backdrop.
  const best = [...pool].sort(
    (a, b) =>
      (b.vote_average || 0) - (a.vote_average || 0) ||
      (b.aspect_ratio || 0) - (a.aspect_ratio || 0),
  )[0];
  return best?.file_path || null;
}

/**
 * Title artwork (the "logo" treatment) for a movie or series, from TMDB's
 * /images endpoint. Returns a file_path or null; callers fall back to text.
 */
export function useTitleLogo(type, id, apiKey) {
  const key = id ? `${type === "tv" ? "tv" : "movie"}_${id}` : null;
  const [logo, setLogo] = useState(() =>
    key && _logoCache.has(key) ? _logoCache.get(key) : null,
  );

  useEffect(() => {
    if (!key || !apiKey) {
      setLogo(null);
      return;
    }
    if (_logoCache.has(key)) {
      setLogo(_logoCache.get(key));
      return;
    }
    let alive = true;
    setLogo(null);
    const lang = (getTmdbLanguage() || "en").split("-")[0];
    const t = type === "tv" ? "tv" : "movie";
    tmdbFetch(
      `/${t}/${id}/images?include_image_language=${lang},en,null`,
      apiKey,
    )
      .then((data) => {
        const path = pickLogo(data?.logos, lang);
        _logoCache.set(key, path);
        if (alive) setLogo(path);
      })
      .catch(() => {
        if (alive) setLogo(null);
      });
    return () => {
      alive = false;
    };
  }, [key, type, id, apiKey]);

  return logo;
}
