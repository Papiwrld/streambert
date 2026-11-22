import { useEffect, useMemo, useState } from "react";
import MediaRow from "./MediaRow";
import { tmdbFetch } from "../utils/api";
import { isRestricted } from "../utils/ageRating";
import { getRatingForItem, useRatings } from "../utils/useRatings";

/**
 * "More like this" on a detail page: TMDB recommendations for the title
 * (falling back to similar titles), with anything the user has already
 * watched pushed to the end so the first picks are new to them.
 */
export default function SimilarRow({
  type, // "movie" | "tv"
  id,
  apiKey,
  onSelect,
  watched,
  onMarkWatched,
  onMarkUnwatched,
}) {
  const [items, setItems] = useState([]);
  const { ratingsMap, ageLimitSetting } = useRatings(items, apiKey);

  useEffect(() => {
    setItems([]);
    if (!apiKey || !id) return;
    let alive = true;
    const pick = (d) =>
      (d?.results || [])
        .filter((r) => r.poster_path && r.id !== id)
        .map((r) => ({ ...r, media_type: type }));
    tmdbFetch(`/${type}/${id}/recommendations`, apiKey)
      .then(pick, () => [])
      .then(async (recommended) => {
        if (!alive || recommended.length >= 6) return recommended;
        try {
          const similar = pick(await tmdbFetch(`/${type}/${id}/similar`, apiKey));
          const seen = new Set(recommended.map((item) => item.id));
          return [...recommended, ...similar.filter((item) => !seen.has(item.id))];
        } catch {
          return recommended;
        }
      })
      .then((r) => alive && setItems(r.slice(0, 20)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type, id, apiKey]);

  const ordered = useMemo(() => {
    const watchedShows = new Set(
      Object.entries(watched || {})
        .filter(([key, value]) => value && key.startsWith("tv_"))
        .map(([key]) => key.split("_")[1]),
    );
    const unseen = [];
    const seen = [];
    for (const item of items) {
      // With an age limit set, hold titles back until their rating is known so
      // a restricted title never flashes in (parental-control safety).
      const rating = ratingsMap[`${type}_${item.id}`];
      if (ageLimitSetting != null && (!rating || isRestricted(rating.minAge, ageLimitSetting))) continue;
      const hasWatched = type === "tv" ? watchedShows.has(String(item.id)) : watched?.[`movie_${item.id}`];
      (hasWatched ? seen : unseen).push(item);
    }
    return [...unseen, ...seen];
  }, [items, watched, type, ratingsMap, ageLimitSetting]);

  if (!ordered.length) return null;

  return (
    <div className="similar-row">
      <MediaRow
        title="More like this"
        items={ordered}
        onSelect={onSelect}
        apiKey={apiKey}
        getCardProps={(item) => ({
          watched,
          onMarkWatched,
          onMarkUnwatched,
          ageRating: getRatingForItem(item, ratingsMap).cert,
        })}
      />
    </div>
  );
}
