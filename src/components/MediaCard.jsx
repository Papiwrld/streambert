import { useState, useLayoutEffect, useRef, useId, memo } from "react";
import { Ellipsis } from "lucide-react";
import { imgUrl, isAnimeContent } from "../utils/api";
import {
  FilmIcon,
  TVIcon,
  WatchedIcon,
  RatingShieldIcon,
  RatingLockIcon,
  PlayIcon,
} from "./Icons";
import "./mediaCard.css";

const MediaCard = memo(function MediaCard({
  item,
  onClick,
  onPlay,
  onResume,
  progress,
  watched,
  onMarkWatched,
  onMarkUnwatched,
  ageRating,
  restricted,
  onRemoveFromRow,
  isSaved,
  onToggleSave,
}) {
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || item.year || "").slice(0, 4);
  const [failedPoster, setFailedPoster] = useState(null);
  const hasPoster = !!item.poster_path && failedPoster !== item.poster_path;
  const isTV = item.media_type === "tv";
  const isAnime = isAnimeContent(item);

  // Unreleased detection
  const rawDate = item.release_date || item.first_air_date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isUnreleased = rawDate ? new Date(rawDate) > today : false;
  // "New": released within the last 30 days (carries real information)
  const isNew =
    !isUnreleased &&
    !!rawDate &&
    today - new Date(rawDate) < 30 * 24 * 60 * 60 * 1000;

  // Bottom tag: one piece of real information, never decoration
  const highlyRated =
    !isUnreleased && item.vote_average >= 8 && (item.vote_count || 0) >= 1000;
  const tag = isNew ? "New" : highlyRated ? "Highly rated" : null;

  // Build watched key for TV cards from Continue Watching we get season/episode
  const watchedKey = isTV
    ? item.season != null && item.episode != null
      ? `tv_${item.id}_s${item.season}e${item.episode}`
      : `tv_${item.id}`
    : `movie_${item.id}`;

  const isWatched = !!watched?.[watchedKey];

  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const openRef = useRef(null);
  const menuId = useId();
  const statusId = useId();
  const canMarkWatched = !isUnreleased && (!isTV || (item.season != null && item.episode != null));
  const mark = canMarkWatched && (isWatched ? onMarkUnwatched : onMarkWatched);
  const canResume = !!onResume && !isWatched && !isUnreleased && !restricted;
  const canPlay = !!onPlay && !isUnreleased && !restricted && !canResume;
  const actions = [
    mark && [isWatched ? "Mark as unwatched" : "Mark as watched", () => mark(watchedKey)],
    canPlay && ["Play", onPlay],
    canResume && onClick && ["View details", onClick],
    onToggleSave && [isSaved ? "Remove from watchlist" : "Add to watchlist", () => onToggleSave(item)],
    onRemoveFromRow && ["Remove from Continue watching", () => onRemoveFromRow(item)],
  ].filter(Boolean);
  const hasMenu = actions.length > 0;
  const progressPercent = !isUnreleased && !isWatched && progress > 0
    ? Math.min(progress, 100)
    : null;
  const status = [
    isTV && item.season != null && item.episode != null
      ? `S${item.season}E${item.episode}${item.episodeName ? ` · ${item.episodeName}` : ""}`
      : [year, isAnime ? "Anime" : isTV ? "Series" : "Movie"].filter(Boolean).join(" · "),
    isUnreleased ? "Coming soon" : isWatched ? "Watched" : "",
    progressPercent ? `${Math.round(progressPercent)}% watched` : "",
  ].filter(Boolean).join(" · ");

  useLayoutEffect(() => {
    if (!menu) return;
    const panel = menuRef.current;
    panel.showPopover();
    const gutter = 8;
    const topEdge = document.documentElement.hasAttribute("data-win-titlebar") ? 32 : 0;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = menu.alignEnd ? menu.x - width : menu.x;
    panel.style.left = `${Math.max(gutter, Math.min(left, window.innerWidth - width - gutter))}px`;
    panel.style.top = `${Math.max(topEdge + gutter, Math.min(menu.y, window.innerHeight - height - gutter))}px`;
    const focusItems = panel.querySelectorAll("button");
    (menu.last ? focusItems[focusItems.length - 1] : focusItems[0])?.focus();

    const dismissOutside = (event) => {
      if (panel.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setMenu(null);
    };
    const dismissOnScroll = (event) => {
      if (event.target === document || event.target.contains?.(triggerRef.current)) setMenu(null);
    };
    const dismissOnResize = () => setMenu(null);
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("scroll", dismissOnScroll, true);
    window.addEventListener("resize", dismissOnResize);
    return () => {
      panel.hidePopover();
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("scroll", dismissOnScroll, true);
      window.removeEventListener("resize", dismissOnResize);
    };
  }, [menu]);

  const closeMenu = (restoreFocus = true) => {
    setMenu(null);
    if (restoreFocus) {
      const target = menu?.returnToCard ? openRef.current : triggerRef.current;
      target?.focus({ preventScroll: true });
    }
  };

  const openFromTrigger = (last = false, returnToCard = false) => {
    const trigger = triggerRef.current.getBoundingClientRect();
    setMenu({ x: trigger.right, y: trigger.bottom + 4, alignEnd: true, last, returnToCard });
  };

  const runAction = (action) => {
    closeMenu();
    action();
  };

  return (
    <div
      className={`card media-card${hasMenu ? " media-card--options" : ""}${isWatched ? " ep-watched" : ""}${isUnreleased ? " card--unreleased" : ""}`}
      onContextMenu={hasMenu ? (e) => {
        if (menuRef.current?.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, returnToCard: true });
      } : undefined}
    >
      <button
        className="media-card__open"
        type="button"
        ref={openRef}
        onClick={canResume ? onResume : onClick}
        aria-label={canResume ? `Resume ${title}` : title}
        aria-describedby={statusId}
        onKeyDown={hasMenu ? (event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            openFromTrigger(false, true);
          }
        } : undefined}
      />
      <div className="card-poster">
        {hasPoster ? (
          <img
            src={imgUrl(item.poster_path, "w342")}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedPoster(item.poster_path)}
          />
        ) : (
          <div className="no-poster">
            {isTV ? <TVIcon /> : <FilmIcon />}
            <span>No image</span>
          </div>
        )}
        {ageRating && (
          <div
            className={`card-age-badge${restricted ? " card-age-badge--restricted" : ""}`}
          >
            {restricted ? (
              <RatingLockIcon size={9} />
            ) : (
              <RatingShieldIcon size={9} />
            )}
            {ageRating}
          </div>
        )}

        {tag && (
          <span className={`card-flag${isNew ? " card-flag--new" : ""}`}>
            {tag}
          </span>
        )}
        {isUnreleased && (
          <div className="card-overlay">
            <div className="card-unreleased-overlay">
              <span className="card-unreleased-label">Coming soon</span>
            </div>
          </div>
        )}
        {progressPercent !== null && (
          <div className="card-progress">
            <div
              className="card-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        {!isUnreleased && isWatched && (
          <div className="card-watched-badge">
            <WatchedIcon size={26} />
          </div>
        )}
        {canResume && <div className="media-card__resume" aria-hidden="true"><PlayIcon size={12} /> Resume</div>}
      </div>
      <div className="card-info">
        <div className="card-title" title={title}>
          {title}
        </div>
        <div className="card-year" id={statusId} title={status}>{status}</div>
      </div>
      {hasMenu && (
        <button
          type="button"
          className="media-card__options"
          ref={triggerRef}
          aria-label={`Options for ${title}`}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          aria-controls={menu ? menuId : undefined}
          onClick={() => menu ? closeMenu() : openFromTrigger()}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            openFromTrigger(event.key === "ArrowUp");
          }}
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
      )}
      {menu && (
        <div
          id={menuId}
          ref={menuRef}
          className="context-menu media-card-menu"
          role="menu"
          aria-label={`Options for ${title}`}
          popover="manual"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
              return;
            }
            if (event.key === "Tab") {
              closeMenu();
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll("button"));
            const index = items.indexOf(document.activeElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          {actions.map(([label, action]) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="context-menu-item"
              onClick={() => runAction(action)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
export default MediaCard;
