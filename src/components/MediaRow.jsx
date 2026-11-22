import { useRef, useState, useEffect, useCallback } from "react";
import MediaCard from "./MediaCard";
import HoverPreview from "./HoverPreview";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

const OPEN_DELAY = 450; // ms of hover before the preview opens
const CLOSE_DELAY = 120;
const cardKey = (item) => `${item.media_type}_${item.id}_${item.season ?? ""}_${item.episode ?? ""}`;
const reducedMotion = () => document.body.classList.contains("no-anim") ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Horizontal, scroll-snapping row of poster cards with edge arrows.
 * `getCardProps(item)` lets callers pass progress / rating props per card.
 */
export default function MediaRow({
  title,
  items,
  onSelect,
  getCardProps,
  apiKey,
  ranked = false,
  isSaved,
  onToggleSave,
}) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // ── Hover preview ────────────────────────────────────────────────────────
  const [preview, setPreview] = useState(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const hoverKey = useRef(null);
  const previewItem = preview && items.find((item) => cardKey(item) === preview.key);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };

  const closePreview = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    hoverKey.current = null;
    setPreview(null);
  }, []);

  const handleOver = (e) => {
    if (e.pointerType !== "mouse") return;
    const cardEl = e.target.closest?.(".media-card");
    if (!cardEl || !trackRef.current?.contains(cardEl)) return;
    if (e.target.closest(".media-card__options, .media-card-menu")) {
      closePreview();
      return;
    }
    const index = Array.prototype.findIndex.call(
      trackRef.current.children,
      (child) => child === cardEl || child.contains(cardEl),
    );
    const item = items[index];
    if (!item) return;
    const key = cardKey(item);
    if (key === hoverKey.current) {
      clearTimeout(closeTimer.current);
      return;
    }
    hoverKey.current = key;
    clearTimers();
    if (
      reducedMotion() || window.innerWidth < 540 || window.innerHeight < 420 ||
      (!item.backdrop_path && !item.overview) || getCardProps?.(item)?.restricted ||
      cardEl.classList.contains("card--unreleased")
    ) {
      return;
    }
    openTimer.current = setTimeout(() => {
      const poster = cardEl.querySelector(".card-poster") || cardEl;
      if (cardEl.isConnected && cardEl.matches(":hover")) {
        setPreview({ key, anchor: poster.getBoundingClientRect() });
      }
    }, OPEN_DELAY);
  };

  const scheduleClose = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(closePreview, CLOSE_DELAY);
  };

  // Any scroll or resize invalidates the anchor position.
  useEffect(() => {
    if (!previewItem) return;
    const main = trackRef.current?.closest(".main");
    const dismiss = (event) => {
      if (event.key === "Escape" || event.key === "Tab") closePreview();
    };
    main?.addEventListener("scroll", closePreview, { passive: true });
    window.addEventListener("resize", closePreview);
    window.addEventListener("blur", closePreview);
    window.addEventListener("keydown", dismiss);
    return () => {
      main?.removeEventListener("scroll", closePreview);
      window.removeEventListener("resize", closePreview);
      window.removeEventListener("blur", closePreview);
      window.removeEventListener("keydown", dismiss);
    };
  }, [previewItem, closePreview]);

  useEffect(() => () => clearTimers(), []);

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const next = {
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    };
    setEdges((previous) => previous.start === next.start && previous.end === next.end ? previous : next);
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges, items.length]);

  const page = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    closePreview();
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reducedMotion() ? "instant" : "smooth" });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className={`row${ranked ? " row--ranked" : ""}`} aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <button
        className="row-arrow row-arrow--prev"
        onClick={() => page(-1)}
        disabled={edges.start}
        aria-label={`Scroll ${title} left`}
      >
        <ChevronLeftIcon />
      </button>
      <div
        className="row-track"
        ref={trackRef}
        onScroll={() => {
          updateEdges();
          if (hoverKey.current) closePreview();
        }}
        onPointerOver={handleOver}
        onPointerLeave={scheduleClose}
        onContextMenu={closePreview}
        onKeyDown={(event) => {
          if (event.defaultPrevented || !["ArrowLeft", "ArrowRight"].includes(event.key) ||
            !event.target.matches(".media-card__open")) return;
          const buttons = Array.from(event.currentTarget.querySelectorAll(".media-card__open"));
          const index = buttons.indexOf(event.target);
          const target = buttons[index + (event.key === "ArrowRight" ? 1 : -1)];
          if (target) {
            event.preventDefault();
            closePreview();
            target.focus();
          }
        }}
      >
        {items.map((item, i) => {
          const card = (
            <MediaCard
              key={cardKey(item)}
              item={item}
              onClick={() => onSelect(item)}
              onPlay={apiKey ? () => onSelect({ ...item, autoplay: true }) : undefined}
              {...(getCardProps ? getCardProps(item) : {})}
            />
          );
          if (!ranked) return card;
          return (
            <div className="rank-item" key={cardKey(item)}>
              <span className="rank-num" aria-hidden="true">
                {i + 1}
              </span>
              {card}
            </div>
          );
        })}
      </div>
      <button
        className="row-arrow row-arrow--next"
        onClick={() => page(1)}
        disabled={edges.end}
        aria-label={`Scroll ${title} right`}
      >
        <ChevronRightIcon />
      </button>
      {previewItem && (
        <HoverPreview
          item={previewItem}
          anchor={preview.anchor}
          apiKey={apiKey}
          ageRating={getCardProps?.(previewItem)?.ageRating}
          saved={isSaved?.(previewItem)}
          onToggleSave={onToggleSave}
          onSelect={(it) => {
            closePreview();
            onSelect(it);
          }}
          onEnter={() => clearTimeout(closeTimer.current)}
          onLeave={scheduleClose}
        />
      )}
    </section>
  );
}

/** Placeholder shown while the home feed loads. */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton-hero">
        <div className="skeleton-hero__content">
          <div className="skeleton skeleton-line" style={{ width: "30%" }} />
          <div className="skeleton" style={{ height: 56, width: "80%" }} />
          <div className="skeleton skeleton-line" style={{ width: "95%" }} />
          <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div className="skeleton" style={{ height: 44, width: 120 }} />
            <div className="skeleton" style={{ height: 44, width: 120 }} />
          </div>
        </div>
      </div>
      {[0, 1].map((r) => (
        <div className="row" key={r}>
          <div className="section-title">
            <div className="skeleton skeleton-line" style={{ width: 180 }} />
          </div>
          <div className="row-track" style={{ overflow: "hidden" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div className="card skeleton-card" key={i}>
                <div className="card-poster" />
                <div className="skeleton skeleton-line" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
