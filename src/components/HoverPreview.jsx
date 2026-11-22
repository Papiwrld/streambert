import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { imgUrl } from "../utils/api";
import TitleArt from "./TitleArt";
import { PlayIcon, StarIcon, BookmarkIcon, BookmarkFillIcon, InfoIcon } from "./Icons";

// TMDB genre ids are stable across movie + TV lists.
const GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy",
  36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery",
  10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller",
  10752: "War", 37: "Western", 10759: "Action & Adventure", 10762: "Kids",
  10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
  10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

const GUTTER = 8;

/**
 * Enlarged preview shown over a hovered poster (Netflix-style).
 * `anchor` is the DOMRect of the hovered poster.
 */
export default function HoverPreview({
  item,
  anchor,
  apiKey,
  ageRating,
  saved,
  onToggleSave,
  onSelect,
  onEnter,
  onLeave,
}) {
  const ref = useRef(null);
  const width = anchor ? Math.min(Math.max(anchor.width * 1.85, 300), 380, window.innerWidth - GUTTER * 2) : 0;

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!anchor || !panel) return;
    const titlebar = document.documentElement.hasAttribute("data-win-titlebar") ? 32 : 0;
    const position = () => {
      const left = Math.max(GUTTER, Math.min(window.innerWidth - width - GUTTER,
        anchor.left + (anchor.width - width) / 2));
      const height = panel.offsetHeight;
      const top = Math.max(titlebar + GUTTER, Math.min(window.innerHeight - height - GUTTER,
        anchor.top + (anchor.height - height) / 2));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [anchor, width]);

  if (!item || !anchor) return null;

  const type = item.media_type === "tv" ? "tv" : "movie";
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const genres = (item.genre_ids || [])
    .map((g) => GENRES[g])
    .filter(Boolean)
    .slice(0, 2);
  const backdrop = item.backdrop_path
    ? imgUrl(item.backdrop_path, "w780")
    : imgUrl(item.poster_path, "w500");

  return createPortal(
    <div
      ref={ref}
      className="hover-preview"
      style={{ width }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() => onSelect(item)}
      role="group"
      aria-label={title}
    >
      <div className="hover-preview__media">
        {backdrop && <img src={backdrop} alt="" draggable={false} />}
        <div className="hover-preview__fade" />
        <TitleArt
          type={type}
          id={item.id}
          apiKey={apiKey}
          title={title}
          as="div"
          className="hover-preview__title"
          size="w300"
        />
      </div>
      <div className="hover-preview__body">
        <div className="hover-preview__actions">
          <button
            type="button"
            className="hover-preview__play"
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ ...item, autoplay: true });
            }}
            aria-label={`Play ${title}`}
          >
            <PlayIcon />
          </button>
          <button
            type="button"
            className="hover-preview__save"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item);
            }}
            aria-label={`View details for ${title}`}
            title="View details"
          >
            <InfoIcon size={15} />
          </button>
          {onToggleSave && (
            <button
              type="button"
              className={`hover-preview__save${saved ? " is-on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(item);
              }}
              aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
              aria-pressed={!!saved}
              title={saved ? "In watchlist" : "Add to watchlist"}
            >
              {saved ? (
                <BookmarkFillIcon size={15} />
              ) : (
                <BookmarkIcon size={15} />
              )}
            </button>
          )}
          <div className="hover-preview__meta">
            {item.vote_average > 0 && (
              <span className="hover-preview__rating">
                <StarIcon size={12} /> {item.vote_average.toFixed(1)}
              </span>
            )}
            {year && <span>{year}</span>}
            {ageRating && <span className="hover-preview__cert">{ageRating}</span>}
            <span>{type === "tv" ? "Series" : "Movie"}</span>
          </div>
        </div>
        {genres.length > 0 && (
          <div className="hover-preview__genres">{genres.join(" · ")}</div>
        )}
        {item.overview && (
          <p className="hover-preview__overview">{item.overview}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
