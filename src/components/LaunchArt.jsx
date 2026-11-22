import { useEffect, useState } from "react";

const DRAW_MS = 1900; // time the artwork stays up before fading
const FADE_MS = 250;

/**
 * Launch artwork: the Lumen mark drawn by hand (play stroke, then the light
 * beam), then the wordmark. Skipped for reduced motion.
 */
export default function LaunchArt() {
  const [phase, setPhase] = useState(() => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("no-anim");
    return reduce ? "done" : "drawing";
  });

  useEffect(() => {
    if (phase !== "drawing") return;
    const t1 = setTimeout(() => setPhase("leaving"), DRAW_MS);
    return () => clearTimeout(t1);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t2 = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(t2);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`launch-art${phase === "leaving" ? " launch-art--leaving" : ""}`}
      onClick={() => setPhase("leaving")}
      aria-hidden="true"
    >
      <svg
        className="launch-art__svg"
        viewBox="40 50 200 150"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* play mark, one hand-drawn stroke that overshoots its start */}
        <path
          className="launch-art__stroke launch-art__play"
          pathLength="1"
          d="M78 74 C 77 100, 77 152, 80 182 C 106 167, 134 150, 160 134 C 136 119, 106 98, 75 72 L 74 80"
        />
        {/* light beam: three uneven strokes */}
        <path
          className="launch-art__stroke launch-art__beam launch-art__beam--1"
          pathLength="1"
          d="M178 102 C 188 96, 197 91, 207 86"
        />
        <path
          className="launch-art__stroke launch-art__beam launch-art__beam--2"
          pathLength="1"
          d="M184 133 C 196 133, 207 134, 219 133"
        />
        <path
          className="launch-art__stroke launch-art__beam launch-art__beam--3"
          pathLength="1"
          d="M178 165 C 188 171, 196 176, 205 181"
        />
      </svg>
      <div className="launch-art__word">Lumen</div>
    </div>
  );
}
