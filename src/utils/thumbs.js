import { useEffect, useState } from "react";
import { storage } from "./storage";

// Thumbs up / down per title: { "movie_123": 1, "tv_456": -1 }.
// Liked titles seed "Recommended for you"; disliked ones are kept out of
// recommendations and the Home hero.
const KEY = "thumbs";
const EVENT = "lumen-thumbs";

export const thumbKey = (type, id) => `${type === "tv" ? "tv" : "movie"}_${id}`;

export function getThumbs() {
  return storage.get(KEY) || {};
}

export function setThumb(type, id, value) {
  const all = getThumbs();
  const key = thumbKey(type, id);
  if (value) all[key] = value;
  else delete all[key];
  storage.set(KEY, all);
  window.dispatchEvent(new Event(EVENT));
}

/** [value (1 | -1 | 0), toggle(value)] for one title, kept in sync app-wide. */
export function useThumb(type, id) {
  const read = () => getThumbs()[thumbKey(type, id)] || 0;
  const [value, setValue] = useState(read);
  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);
  const toggle = (next) => setThumb(type, id, value === next ? 0 : next);
  return [value, toggle];
}
