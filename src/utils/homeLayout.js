// ── Home Page Layout Utilities ────────────────────────────────────────────────
// Shared between SettingsPage (editing) and HomePage (reading).

import { storage } from "./storage";

export const HOME_ROWS = [
  { id: "continue", label: "Continue watching" },
  { id: "recent", label: "Recently watched" },
  { id: "top10", label: "Top 10 today" },
  { id: "myList", label: "My list" },
  { id: "recommended", label: "Recommended for you" },
  { id: "trendingMovies", label: "Trending movies" },
  { id: "trendingTV", label: "Trending series" },
  { id: "topRated", label: "Top rated" },
];

const DEFAULT_ROW_ORDER = HOME_ROWS.map((r) => r.id);
const DEFAULT_ROW_VISIBLE = Object.fromEntries(
  HOME_ROWS.map((r) => [r.id, true]),
);

export function loadHomeLayout() {
  const savedOrder = storage.get("homeRowOrder");
  const savedVisible = storage.get("homeRowVisible");
  const knownIds = new Set(HOME_ROWS.map((r) => r.id));

  // Rows added in newer versions slot in after their default predecessor
  const order = savedOrder ? savedOrder.filter((id) => knownIds.has(id)) : [];
  if (savedOrder) {
    DEFAULT_ROW_ORDER.forEach((id, i) => {
      if (order.includes(id)) return;
      const prev = DEFAULT_ROW_ORDER[i - 1];
      const at = prev ? order.indexOf(prev) : -1;
      order.splice(at + 1, 0, id);
    });
  } else {
    order.push(...DEFAULT_ROW_ORDER);
  }

  const visible = savedVisible
    ? { ...DEFAULT_ROW_VISIBLE, ...savedVisible }
    : DEFAULT_ROW_VISIBLE;

  return { order, visible };
}

export function saveHomeLayout(order, visible) {
  storage.set("homeRowOrder", order);
  storage.set("homeRowVisible", visible);
}

/** "carousel" (default) | "list" */
export function loadHomeViewMode() {
  return storage.get("homeViewMode") || "carousel";
}

export function saveHomeViewMode(mode) {
  storage.set("homeViewMode", mode);
}

export function loadStartPage() {
  return storage.get("startPage") || "home";
}
