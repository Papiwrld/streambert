import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon } from "./Icons";
import { getActiveModal } from "../utils/useModal";

const CHROME_INTRO_MS = 3000; // how long the top bar shows before hiding

/**
 * Netflix-style watch view. Playback takes over the whole window: the video
 * fills it edge to edge, and the only chrome is a top bar (Back and the
 * title) that fades out and comes back when you move the pointer to the top.
 * The detail page underneath keeps its scroll position, so closing returns
 * you exactly where you were. The app window is maximized while watching
 * and restored afterwards if it wasn't maximized before.
 */
export default function WatchView({ title, subtitle, onClose, children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), CHROME_INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  // Maximize the window for playback; put it back afterwards.
  useEffect(() => {
    const api = window.electron;
    if (!api?.windowIsMaximized || !api?.windowToggleMaximize) return;
    let cancelled = false;
    let maximizedByUs = false;
    api
      .windowIsMaximized()
      .then((isMax) => {
        if (cancelled || isMax) return;
        maximizedByUs = true;
        return api.windowToggleMaximize();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (!maximizedByUs) return;
      api
        .windowIsMaximized()
        .then((isMax) => isMax && api.windowToggleMaximize())
        .catch(() => {});
    };
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    ref.current
      ?.querySelector(".watch-view__back")
      ?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || getActiveModal()) return;
      if (document.documentElement.hasAttribute("data-player-fullscreen")) return;
      if (e.target?.closest?.('input, textarea, select, [role="menu"], [role="listbox"]')) return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("is-watching");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("is-watching");
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      className={`watch-view${intro ? " watch-view--intro" : ""}`}
      ref={ref}
      role="region"
      aria-label={`Watching ${title}`}
    >
      <div className="watch-view__bar">
        <button
          type="button"
          className="watch-view__back"
          data-gamepad-close
          onClick={() => onCloseRef.current?.()}
          title="Back (Esc)"
          aria-label={`Back to ${title}`}
        >
          <ChevronLeftIcon size={22} />
        </button>
        <div className="watch-view__title">
          <span className="watch-view__show">{title}</span>
          {subtitle && <span className="watch-view__ep">{subtitle}</span>}
        </div>
      </div>
      <div className="watch-view__body">{children}</div>
    </div>,
    document.body,
  );
}
