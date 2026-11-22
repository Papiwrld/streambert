import { useEffect, useRef, useState } from "react";
import { tmdbFetch } from "../utils/api";
import { storage, STORAGE_KEYS } from "../utils/storage";
import {
  getInvidiousBase,
  FALLBACK_INSTANCES,
  DETECT_BOT_JS,
} from "./TrailerModal";
import { VolumeIcon, VolumeOffIcon } from "./Icons";

const START_DELAY = 2500; // ms of backdrop before the trailer fades in
const MAX_TRIES = 3;

// Strip the embed down to just the picture, start muted, report the end.
const BACKGROUND_JS = `
(function() {
  if (window.__heroSetup) return true
  var style = document.createElement('style')
  style.textContent = '.vjs-control-bar,.vjs-big-play-button,.vjs-title-bar,.vjs-loading-spinner,.vjs-text-track-display,.vjs-poster,.vjs-invidious-button,a[href*="/watch"],.vjs-overlay{display:none!important}body,html,.video-js,video{background:#000!important;cursor:default!important}'
  document.head.appendChild(style)
  var v = document.querySelector('video')
  if (!v) return false
  window.__heroSetup = true
  v.muted = true
  v.loop = false
  v.addEventListener('ended', function() { window.__heroEnded = true })
  v.addEventListener('playing', function() { window.__heroPlaying = true })
  var p = v.play(); if (p && p.catch) p.catch(function(){})
  return true
})()
`;

/**
 * Muted background trailer for the home hero. Fades in over the backdrop,
 * fades back out when it ends or fails. Pointer events pass through to the hero.
 */
export default function HeroTrailer({
  movieId,
  apiKey,
  containerRef,
  type = "movie",
}) {
  const [videoKey, setVideoKey] = useState(null);
  const [src, setSrc] = useState(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const wvRef = useRef(null);
  const triesRef = useRef(0);

  const enabled =
    storage.get(STORAGE_KEYS.HERO_TRAILER) !== false &&
    !storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS) &&
    !prefersReducedMotion;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Look up the YouTube trailer key
  useEffect(() => {
    setVideoKey(null);
    setSrc(null);
    setVisible(false);
    if (!enabled || !movieId || !apiKey) return;
    let alive = true;
    tmdbFetch(`/${type}/${movieId}/videos`, apiKey)
      .then((data) => {
        const vids = data?.results || [];
        const v =
          vids.find((x) => x.type === "Trailer" && x.site === "YouTube") ||
          vids.find((x) => x.site === "YouTube");
        if (alive && v) setVideoKey(v.key);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [movieId, apiKey, enabled, type]);

  const instanceUrl = (i) => {
    const preferred = getInvidiousBase();
    const list = [preferred, ...FALLBACK_INSTANCES.filter((x) => x !== preferred)];
    return list[i] ? `${list[i]}/embed/${videoKey}?autoplay=1&controls=0` : null;
  };

  // Start after a short pause on the backdrop
  useEffect(() => {
    if (!videoKey) return;
    triesRef.current = 0;
    const t = setTimeout(() => setSrc(instanceUrl(0)), START_DELAY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey]);

  // Wire up the webview once it exists
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv || !src) return;
    let poll = null;

    const giveUp = () => {
      setVisible(false);
      clearInterval(poll);
    };
    const tryNext = () => {
      triesRef.current += 1;
      const next = triesRef.current < MAX_TRIES ? instanceUrl(triesRef.current) : null;
      if (next) setSrc(next);
      else giveUp();
    };
    const onLoad = () => {
      wv.executeJavaScript(DETECT_BOT_JS)
        .then((isBot) => {
          if (isBot) return tryNext();
          poll = setInterval(() => {
            wv.executeJavaScript(
              `(${BACKGROUND_JS.trim().replace(/;$/, "")}, [!!window.__heroPlaying, !!window.__heroEnded])`,
            )
              .then(([playing, ended]) => {
                if (ended) {
                  giveUp();
                  setSrc(null);
                } else if (playing) {
                  setVisible(true);
                }
              })
              .catch(() => {});
          }, 500);
        })
        .catch(tryNext);
    };
    const onWillNavigate = (e) => e.preventDefault();

    wv.addEventListener("did-finish-load", onLoad);
    wv.addEventListener("did-fail-load", tryNext);
    wv.addEventListener("will-navigate", onWillNavigate);
    return () => {
      clearInterval(poll);
      wv.removeEventListener("did-finish-load", onLoad);
      wv.removeEventListener("did-fail-load", tryNext);
      wv.removeEventListener("will-navigate", onWillNavigate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Pause when the hero scrolls out of view or the window loses focus
  useEffect(() => {
    const el = containerRef?.current;
    if (!el || !src) return;
    const setPlaying = (play) =>
      wvRef.current
        ?.executeJavaScript(
          `(function(){var v=document.querySelector('video');if(v){${play ? "v.play()" : "v.pause()"}}})()`,
        )
        .catch(() => {});
    const io = new IntersectionObserver(
      ([entry]) => setPlaying(entry.intersectionRatio > 0.4),
      { root: document.querySelector(".main"), threshold: [0, 0.4, 1] },
    );
    io.observe(el);
    const onBlur = () => setPlaying(false);
    const onFocus = () => setPlaying(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      io.disconnect();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [src, containerRef]);

  const toggleMute = (e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    wvRef.current
      ?.executeJavaScript(
        `(function(){var v=document.querySelector('video');if(v){v.muted=${next}}})()`,
      )
      .catch(() => {});
  };

  if (!src) return null;

  return (
    <>
      <webview
        ref={wvRef}
        src={src}
        partition="persist:trailer"
        allowpopups="false"
        className={`hero-trailer${visible ? " hero-trailer--visible" : ""}`}
      />
      {visible && (
        <button
          className="icon-action hero-mute"
          onClick={toggleMute}
          aria-label={muted ? "Unmute trailer" : "Mute trailer"}
          aria-pressed={!muted}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeOffIcon /> : <VolumeIcon />}
        </button>
      )}
    </>
  );
}
