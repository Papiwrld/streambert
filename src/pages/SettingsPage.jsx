import { useState, useEffect, useRef, useMemo } from "react";
import UpdateModal from "../components/UpdateModal";
import { getActiveModal, useModal } from "../utils/useModal";
import {
  storage,
  STORAGE_KEYS,
  secureStorage,
  isElectron,
  clearAppCaches,
  formatBytes,
} from "../utils/storage";
import { clearTmdbCache } from "../utils/api";
import {
  ACCENT_PRESETS,
  applyAccentColor,
  THEME_PRESETS,
  applyTheme,
  DEFAULT_CUSTOM_VARS,
} from "../utils/appearance";
import { SUBTITLE_LANGUAGES } from "../utils/subtitles";
import { DEFAULT_INVIDIOUS_BASE } from "../components/TrailerModal";
import { RATING_COUNTRIES } from "../utils/ageRating";
import {
  WarningIcon,
  RefreshIcon,
  RatingShieldIcon,
  PlayIcon,
  SubtitlesIcon,
  DownloadIcon,
  BellIcon,
  GamepadIcon,
  PaletteIcon,
  LibraryIcon,
  ArchiveIcon,
  DatabaseIcon,
  SearchIcon,
  CloseIcon,
  CheckIcon,
  ChevronDownIcon,
  UploadIcon,
  GripVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CopyIcon,
  EyeOpenIcon,
  EyeOffIcon,
  FolderOpenIcon,
  ExternalLinkIcon,
} from "../components/Icons";
import {
  checkForUpdatesWithFallback,
  UPDATE_SOURCES,
  DEFAULT_UPDATE_SOURCE,
} from "../utils/updates";
import {
  HOME_ROWS,
  loadHomeLayout,
  loadHomeViewMode,
  saveHomeViewMode,
} from "../utils/homeLayout";
import { collectBackupData, restoreBackupData } from "../utils/backup";

// ── Reusable Primitives ───────────────────────────────────────────────────────
function Toggle({ value, onChange, title, ariaLabel, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      aria-label={ariaLabel || title}
      disabled={disabled}
      title={title}
      className={`lumen-switch${value ? " lumen-switch--on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <span className="lumen-switch__knob" />
    </button>
  );
}

function SavedIndicator({ show, label = "Saved" }) {
  if (!show) return null;
  return (
    <span className="settings-saved" role="status">
      <CheckIcon size={13} />
      {label}
    </span>
  );
}

function SettingsSelect({ value, onChange, options, fullWidth = false, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selectedLabel =
    options.find((o) => String(o.value) === String(value))?.label ?? value;

  const focusTrigger = () =>
    ref.current?.querySelector(".lumen-select__trigger")?.focus({
      preventScroll: true,
    });

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector('[role="option"][aria-selected="true"]')?.focus({
      preventScroll: true,
    });
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        focusTrigger();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={`lumen-select${fullWidth ? " lumen-select--full" : ""}`}
      style={style}
      onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const items = [...ref.current.querySelectorAll('[role="option"]')];
        const index = items.indexOf(document.activeElement);
        const next =
          e.key === "Home" ? 0
            : e.key === "End" ? items.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`lumen-select__trigger${open ? " lumen-select__trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lumen-select__value">{selectedLabel}</span>
        <span className="lumen-select__chevron">
          <ChevronDownIcon size={14} />
        </span>
      </button>

      {open && (
        <div className="lumen-select__menu" role="listbox">
          {options.map((o) => {
            const active = String(o.value) === String(value);
            return (
              <button
                type="button"
                role="option"
                aria-selected={active}
                key={o.value}
                className={`lumen-select__option${active ? " lumen-select__option--active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  focusTrigger();
                }}
              >
                <span>{o.label}</span>
                {active && <CheckIcon size={13} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  warningNote = "This action cannot be undone.",
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}) {
  const { dialogProps, backdropProps, titleId, descriptionId } = useModal(onCancel);

  return (
    <div className="lumen-dialog-backdrop" {...backdropProps}>
      <div
        className="lumen-dialog lumen-dialog--sm"
        {...dialogProps}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="lumen-dialog__body">
          <div className="lumen-dialog__icon-badge lumen-dialog__icon-badge--danger">
            <WarningIcon size={22} />
          </div>
          <div
            id={titleId}
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              marginBottom: 8,
              color: "var(--text)",
            }}
          >
            {title}
          </div>
          <div
            id={descriptionId}
            style={{
              fontSize: 13,
              color: "var(--text2)",
              lineHeight: 1.65,
            }}
          >
            {description}
            {warningNote && (
              <div style={{ marginTop: 12, color: "var(--red)", fontWeight: 500 }}>
                {warningNote}
              </div>
            )}
          </div>
        </div>
        <div className="lumen-dialog__footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost btn--sm" onClick={onCancel} data-modal-initial-focus>
            Cancel
          </button>
          <button type="button" className="btn btn-danger btn--sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ status }) {
  if (!status) return null;
  const isError = status.type === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      style={{
        marginTop: 6,
        fontSize: 12,
        fontWeight: 500,
        color: isError ? "var(--red)" : "var(--success)",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {isError ? <WarningIcon size={13} /> : <CheckIcon size={13} />}
      <span>{status.text}</span>
    </div>
  );
}

function CleanRow({
  title,
  description,
  buttonLabel,
  onAction,
  danger,
  sizeLabel,
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const handle = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await onAction();
      if (result?.cancelled) return;
      setStatus({ type: "ok", text: result?.msg || "Done" });
      setTimeout(() => setStatus(null), 4000);
    } catch (e) {
      setStatus({ type: "error", text: e.message || "Something went wrong" });
      setTimeout(() => setStatus(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-row settings-row--top">
      <div className="settings-row__info">
        <div className="settings-row__label">
          <span>{title}</span>
          {sizeLabel && <span className="lumen-badge lumen-badge--neutral">{sizeLabel}</span>}
        </div>
        <div className="settings-row__desc">{description}</div>
        <StatusMessage status={status} />
      </div>
      <div className="settings-row__control">
        <button
          type="button"
          className={`btn btn--sm ${danger ? "btn-danger-ghost" : "btn-secondary"}`}
          disabled={busy}
          onClick={handle}
        >
          {busy ? "Working…" : buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AGE_LIMIT_OPTIONS = [
  { value: "", label: "No restriction" },
  { value: "0", label: "0 — All audiences (G / FSK 0)" },
  { value: "7", label: "7 — Family friendly (PG / FSK 6)" },
  { value: "12", label: "12 — Teens and up" },
  { value: "13", label: "13 — PG-13 and equivalent" },
  { value: "15", label: "15 — Older teens" },
  { value: "16", label: "16 — FSK 16 and equivalent" },
  { value: "17", label: "17 — R / 17+ and equivalent" },
  { value: "18", label: "18 — Adults only (NC-17 / FSK 18)" },
];

const TMDB_LANGUAGES = [
  { value: "en-US", label: "English (en-US)" },
  { value: "de-DE", label: "Deutsch (de-DE)" },
  { value: "fr-FR", label: "Français (fr-FR)" },
  { value: "es-ES", label: "Español (es-ES)" },
  { value: "it-IT", label: "Italiano (it-IT)" },
  { value: "pt-BR", label: "Português (Brasil) (pt-BR)" },
  { value: "nl-NL", label: "Nederlands (nl-NL)" },
  { value: "pl-PL", label: "Polski (pl-PL)" },
  { value: "sv-SE", label: "Svenska (sv-SE)" },
  { value: "nb-NO", label: "Norsk (nb-NO)" },
  { value: "da-DK", label: "Dansk (da-DK)" },
  { value: "fi-FI", label: "Suomi (fi-FI)" },
  { value: "tr-TR", label: "Türkçe (tr-TR)" },
  { value: "ru-RU", label: "Русский (ru-RU)" },
  { value: "ja-JP", label: "日本語 (ja-JP)" },
  { value: "ko-KR", label: "한국어 (ko-KR)" },
  { value: "zh-CN", label: "中文 (简体) (zh-CN)" },
  { value: "ar-SA", label: "العربية (ar-SA)" },
];

const FREQUENCY_OPTIONS = [
  { value: "startup", label: "On app start" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CUSTOM_VAR_LABELS = {
  "--bg": "Background",
  "--surface": "Surface",
  "--surface2": "Surface 2",
  "--surface3": "Surface 3",
  "--border": "Border",
  "--text": "Text",
  "--text2": "Text 2",
  "--text3": "Text 3",
};

const SECTION_NAV = [
  {
    id: "updates",
    label: "General",
    subtitle: "App version, updates, API credentials, and metadata language",
    icon: <RefreshIcon size={15} />,
    keywords: [
      "update",
      "version",
      "tmdb",
      "api",
      "token",
      "key",
      "check",
      "startup",
      "auto",
      "app",
      "language",
      "metadata",
      "locale",
      "german",
      "french",
      "spanish",
    ],
  },
  {
    id: "content",
    label: "Age rating",
    subtitle: "Parental controls and content filtering by age rating",
    icon: <RatingShieldIcon size={15} />,
    keywords: [
      "age",
      "rating",
      "parental",
      "content",
      "country",
      "restriction",
      "pg",
      "fsk",
      "adults",
    ],
  },
  {
    id: "playback",
    label: "Playback",
    subtitle: "Trailer source, watched threshold, autoplay, and intro skip",
    icon: <PlayIcon size={15} />,
    keywords: [
      "invidious",
      "trailer",
      "hero",
      "youtube",
      "threshold",
      "watched",
      "playback",
      "seconds",
      "mark",
      "auto-watched",
      "autoplay",
      "next episode",
      "countdown",
      "intro",
      "skip",
      "aniskip",
      "anime",
      "outro",
    ],
  },
  {
    id: "subtitles",
    label: "Subtitles",
    subtitle: "Subtitle download source, preferred language, and API keys",
    icon: <SubtitlesIcon size={15} />,
    keywords: [
      "subtitle",
      "subdl",
      "wyzie",
      "language",
      "caption",
      "srt",
      "download",
      "cc",
    ],
  },
  {
    id: "downloads",
    label: "Downloads",
    subtitle: "Where downloaded video files are saved on disk",
    icon: <DownloadIcon size={15} />,
    keywords: [
      "download",
      "folder",
      "path",
      "save",
      "video",
      "movies",
      "files",
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "Desktop alerts for downloads and new episode releases",
    icon: <BellIcon size={15} />,
    keywords: [
      "notification",
      "notify",
      "alert",
      "desktop",
      "episode",
      "download",
      "watchlist",
      "new episode",
      "release",
    ],
  },
  {
    id: "discordRpc",
    label: "Discord Rich Presence",
    subtitle: "Show what you're watching on your Discord profile",
    icon: <GamepadIcon size={15} />,
    keywords: [
      "discord",
      "rich presence",
      "rpc",
      "status",
      "activity",
      "watching",
      "idling",
      "presence",
    ],
  },
  {
    id: "interface",
    label: "Interface",
    subtitle: "Home layout, start page, appearance, and display options",
    icon: <PaletteIcon size={15} />,
    keywords: [
      "home",
      "layout",
      "start page",
      "appearance",
      "accent",
      "colour",
      "color",
      "font",
      "compact",
      "animation",
      "theme",
      "rows",
      "grid",
      "hero",
      "controller",
      "gamepad",
    ],
  },
  {
    id: "library",
    label: "Library",
    subtitle: "Watchlist sort order and watch history preferences",
    icon: <LibraryIcon size={15} />,
    keywords: [
      "library",
      "watchlist",
      "sort",
      "history",
      "privacy",
      "watch history",
      "continue",
    ],
  },
  {
    id: "backup",
    label: "Backup & restore",
    subtitle: "Export your data, import a backup, or schedule automatic backups",
    icon: <ArchiveIcon size={15} />,
    keywords: [
      "backup",
      "restore",
      "export",
      "import",
      "scheduled",
      "json",
      "backup file",
    ],
  },
  {
    id: "storage",
    label: "Storage & data",
    subtitle: "Install folder, cache, watch progress, downloads, and reset",
    icon: <DatabaseIcon size={15} />,
    keywords: [
      "storage",
      "cache",
      "clear",
      "reset",
      "delete",
      "data",
      "wipe",
      "progress",
      "factory",
      "install",
    ],
  },
];

// ── General Sections ──────────────────────────────────────────────────────────
function VersionCard() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [autoCheck, setAutoCheck] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.AUTO_CHECK_UPDATES);
    return stored === null || stored === undefined ? true : !!stored;
  });
  const [autoSaved, setAutoSaved] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("0.0.0");
  const [updateSource, setUpdateSource] = useState(
    () => storage.get(STORAGE_KEYS.UPDATE_SOURCE) || DEFAULT_UPDATE_SOURCE,
  );

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((v) => setCurrentVersion(v));
    }
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const r = await checkForUpdatesWithFallback(updateSource);
      setResult(r);
    } catch (e) {
      setResult({
        error:
          e.message ||
          `Could not reach ${UPDATE_SOURCES[updateSource]?.label || "the update server"}.`,
      });
    } finally {
      setChecking(false);
    }
  };

  const changeSource = (src) => {
    setUpdateSource(src);
    storage.set(STORAGE_KEYS.UPDATE_SOURCE, src);
    setResult(null);
  };

  const toggleAuto = (val) => {
    setAutoCheck(val);
    storage.set(STORAGE_KEYS.AUTO_CHECK_UPDATES, val ? 1 : 0);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1800);
  };

  return (
    <div className="settings-card">
      <div className="settings-row settings-row--top">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>App version</span>
            <span className="lumen-badge lumen-badge--neutral">
              v{currentVersion}
            </span>
          </div>
          <div className="settings-row__desc">
            Check for new releases and choose your preferred update mirror.
          </div>

          {result && !result.error && result.hasUpdate && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn--sm"
                onClick={() => setShowUpdateModal(true)}
              >
                Version {result.latest} available · Install update
              </button>
            </div>
          )}

          {result?.usedFallback && (
            <div className="settings-row__desc" style={{ marginTop: 6 }}>
              {UPDATE_SOURCES[result.fallbackFrom]?.label || result.fallbackFrom}{" "}
              unavailable; used {result.sourceLabel} instead.
            </div>
          )}

          {result && !result.error && !result.hasUpdate && (
            <StatusMessage status={{ type: "ok", text: "You're up to date" }} />
          )}

          {result?.error && (
            <StatusMessage status={{ type: "error", text: result.error }} />
          )}
        </div>

        <div className="settings-row__control">
          {Object.keys(UPDATE_SOURCES).length > 1 && (
          <div className="lumen-segmented" role="group" aria-label="Update source">
            {Object.values(UPDATE_SOURCES).map((src) => (
              <button
                type="button"
                key={src.id}
                disabled={checking}
                onClick={() => changeSource(src.id)}
                title={`Check for updates via ${src.label}`}
                className={`lumen-segmented__btn${updateSource === src.id ? " lumen-segmented__btn--active" : ""}`}
              >
                {src.label}
              </button>
            ))}
          </div>
          )}
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            disabled={checking}
            onClick={runCheck}
          >
            {checking ? "Checking…" : "Check for updates"}
          </button>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>Check for updates on startup</span>
            <SavedIndicator show={autoSaved} />
          </div>
          <div className="settings-row__desc">
            Shows a notification banner if a new version is available.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={autoCheck}
            onChange={toggleAuto}
            title={autoCheck ? "Disable auto-check" : "Enable auto-check"}
          />
        </div>
      </div>

      {showUpdateModal && result?.hasUpdate && (
        <UpdateModal
          updateInfo={result}
          onClose={() => setShowUpdateModal(false)}
        />
      )}
    </div>
  );
}

function TmdbLanguageCard() {
  const [lang, setLang] = useState(
    () => storage.get(STORAGE_KEYS.TMDB_LANG) || "en-US",
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    storage.set(STORAGE_KEYS.TMDB_LANG, lang);
    clearTmdbCache();
    window.dispatchEvent(new CustomEvent("streambert:tmdb-lang-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-card">
      <div className="settings-row settings-row--top">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>Metadata language</span>
            <SavedIndicator show={saved} label="Saved, cache cleared" />
          </div>
          <div className="settings-row__desc">
            Language used when fetching titles and descriptions from TMDB.
            Saving clears the metadata cache so updated content loads right away.
          </div>
        </div>
        <div className="settings-row__control">
          <SettingsSelect
            value={lang}
            onChange={setLang}
            options={TMDB_LANGUAGES}
          />
          <button
            type="button"
            className="btn btn-primary btn--sm"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subtitle Settings ─────────────────────────────────────────────────────────
function SubtitleSettingsSection() {
  const [enabled, setEnabled] = useState(
    () =>
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== 0 &&
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== "0",
  );
  const [lang, setLang] = useState(
    () => storage.get(STORAGE_KEYS.SUBTITLE_LANG) || "en",
  );
  const [subdlApiKey, setSubdlApiKey] = useState("");
  const [showSubdlKey, setShowSubdlKey] = useState(false);
  const [wyzieApiKey, setWyzieApiKey] = useState("");
  const [showWyzieKey, setShowWyzieKey] = useState(false);
  const [wyzieCopied, setWyzieCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    secureStorage.get(STORAGE_KEYS.SUBDL_API_KEY).then((val) => {
      if (val) setSubdlApiKey(val);
    });
    secureStorage.get(STORAGE_KEYS.WYZIE_API_KEY).then((val) => {
      if (val) setWyzieApiKey(val);
    });
  }, []);

  const hasSubdlKey = subdlApiKey.trim().length > 0;
  const hasWyzieKey = wyzieApiKey.trim().length > 0;

  const handleWyzieCopy = () => {
    navigator.clipboard.writeText(wyzieApiKey.trim()).then(() => {
      setWyzieCopied(true);
      setTimeout(() => setWyzieCopied(false), 1500);
    });
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.SUBTITLE_ENABLED, enabled ? 1 : 0);
    storage.set(STORAGE_KEYS.SUBTITLE_LANG, lang);
    secureStorage.set(STORAGE_KEYS.SUBDL_API_KEY, subdlApiKey.trim());
    secureStorage.set(STORAGE_KEYS.WYZIE_API_KEY, wyzieApiKey.trim());
    window.dispatchEvent(new CustomEvent("streambert:player-settings-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>Auto-download subtitles</span>
            {hasSubdlKey && (
              <span className="lumen-badge lumen-badge--info">SubDL active</span>
            )}
          </div>
          <div className="settings-row__desc">
            Uses Wyzie Subs by default (free key, no account needed). Add a{" "}
            <button
              type="button"
              className="settings-link-btn"
              onClick={() =>
                window.electron?.openExternal("https://subdl.com/settings")
              }
            >
              SubDL API key
            </button>{" "}
            to use SubDL as your primary source instead.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={enabled}
            onChange={setEnabled}
            ariaLabel="Auto-download subtitles"
          />
        </div>
      </div>

      {enabled && (
        <>
          <div className="settings-row">
            <div className="settings-row__info">
              <div className="settings-row__label">Default language</div>
              <div className="settings-row__desc">
                Preferred subtitle language for search and downloads.
              </div>
            </div>
            <div className="settings-row__control">
              <SettingsSelect
                value={lang}
                onChange={setLang}
                options={SUBTITLE_LANGUAGES.map((l) => ({
                  value: l.code,
                  label: l.label,
                }))}
              />
            </div>
          </div>

          <div className="settings-row settings-row--stack">
            <div className="settings-row__info">
              <div className="settings-row__label">
                <span>Wyzie API key</span>
                <span
                  className={`lumen-badge ${hasWyzieKey ? "lumen-badge--success" : "lumen-badge--warn"}`}
                >
                  {hasWyzieKey ? "Set" : "Required"}
                </span>
              </div>
              <div className="settings-row__desc">
                Required for Wyzie Subs.{" "}
                <button
                  type="button"
                  className="settings-link-btn"
                  onClick={() =>
                    window.electron?.openExternal(
                      "https://codeberg.org/truelockmc/streambert/src/branch/main/wyzie-tutorial.md",
                    )
                  }
                >
                  How to get a key
                </button>
              </div>
            </div>

            <div className="settings-inline-row">
              <input
                className="lumen-input lumen-input--mono"
                style={{ flex: 1, minWidth: 220, maxWidth: 340 }}
                type={showWyzieKey ? "text" : "password"}
                placeholder="wyzie-..."
                value={wyzieApiKey}
                onChange={(e) => setWyzieApiKey(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn--sm"
                onClick={() => setShowWyzieKey((v) => !v)}
              >
                {showWyzieKey ? <EyeOffIcon /> : <EyeOpenIcon />}
                {showWyzieKey ? "Hide" : "Show"}
              </button>
              {hasWyzieKey && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn--sm"
                    onClick={handleWyzieCopy}
                    title="Copy key"
                  >
                    <CopyIcon />
                    {wyzieCopied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn--sm"
                    onClick={() =>
                      window.electron?.openExternal(
                        `https://store.wyzie.io/dashboard?key=${wyzieApiKey.trim()}`,
                      )
                    }
                    title="Open your Wyzie dashboard"
                  >
                    Dashboard
                    <ExternalLinkIcon size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="settings-row settings-row--stack">
            <div className="settings-row__info">
              <div className="settings-row__label">
                <span>SubDL API key</span>
                <span className="lumen-badge lumen-badge--neutral">
                  Optional
                </span>
              </div>
              <div className="settings-row__desc">
                Leave empty to use Wyzie Subs.{" "}
                <button
                  type="button"
                  className="settings-link-btn"
                  onClick={() =>
                    window.electron?.openExternal("https://subdl.com/settings")
                  }
                >
                  Register at subdl.com
                </button>{" "}
                for a free key.
              </div>
            </div>

            <div className="settings-inline-row">
              <input
                className="lumen-input lumen-input--mono"
                style={{ flex: 1, minWidth: 220, maxWidth: 340 }}
                type={showSubdlKey ? "text" : "password"}
                placeholder="SubDL API key (optional)"
                value={subdlApiKey}
                onChange={(e) => setSubdlApiKey(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn--sm"
                onClick={() => setShowSubdlKey((v) => !v)}
              >
                {showSubdlKey ? <EyeOffIcon /> : <EyeOpenIcon />}
                {showSubdlKey ? "Hide" : "Show"}
              </button>
              {hasSubdlKey && (
                <button
                  type="button"
                  className="btn btn-ghost btn--sm"
                  onClick={() => setSubdlApiKey("")}
                  title="Clear key (revert to Wyzie)"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="settings-row">
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary btn--sm"
            onClick={handleSave}
          >
            Save
          </button>
          <SavedIndicator show={saved} />
        </div>
      </div>
    </div>
  );
}

// ── Notifications Section ─────────────────────────────────────────────────────
function NotificationsSection({ onSavedFlash }) {
  const [notifyDownload, setNotifyDownload] = useState(
    () => storage.get(STORAGE_KEYS.NOTIFY_DOWNLOAD_COMPLETE) !== false,
  );
  const [notifyEpisode, setNotifyEpisode] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.NOTIFY_NEW_EPISODE);
    return stored === null || stored === undefined ? true : !!stored;
  });

  const updateDownload = (val) => {
    setNotifyDownload(val);
    storage.set(STORAGE_KEYS.NOTIFY_DOWNLOAD_COMPLETE, val);
    onSavedFlash?.();
  };

  const updateEpisode = (val) => {
    setNotifyEpisode(val);
    storage.set(STORAGE_KEYS.NOTIFY_NEW_EPISODE, val);
    onSavedFlash?.();
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            Notify when a download completes
          </div>
          <div className="settings-row__desc">
            Shows a desktop notification when an item finishes downloading.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={notifyDownload}
            onChange={updateDownload}
            ariaLabel="Notify when a download completes"
          />
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            Notify about new episodes on startup
          </div>
          <div className="settings-row__desc">
            Checks every saved TV series on startup and notifies you if new
            episodes have aired since the last check.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={notifyEpisode}
            onChange={updateEpisode}
            ariaLabel="Notify about new episodes on startup"
          />
        </div>
      </div>
    </div>
  );
}

// ── Discord Rich Presence Section ─────────────────────────────────────────────
function DiscordRpcSection({ onSavedFlash }) {
  const [enabled, setEnabledState] = useState(
    () => !!storage.get(STORAGE_KEYS.DISCORD_RPC_ENABLED),
  );
  const [showCover, setShowCover] = useState(
    () => storage.get(STORAGE_KEYS.DISCORD_RPC_SHOW_COVER) !== false,
  );
  const [showTimestamp, setShowTimestamp] = useState(
    () => storage.get(STORAGE_KEYS.DISCORD_RPC_SHOW_TIMESTAMP) !== false,
  );
  const [showButton, setShowButton] = useState(
    () => storage.get(STORAGE_KEYS.DISCORD_RPC_SHOW_BUTTON) !== false,
  );

  const persist = (next) => {
    storage.set(STORAGE_KEYS.DISCORD_RPC_ENABLED, next.enabled);
    storage.set(STORAGE_KEYS.DISCORD_RPC_SHOW_COVER, next.showCover);
    storage.set(STORAGE_KEYS.DISCORD_RPC_SHOW_TIMESTAMP, next.showTimestamp);
    storage.set(STORAGE_KEYS.DISCORD_RPC_SHOW_BUTTON, next.showButton);
    window.dispatchEvent(
      new CustomEvent("streambert:discord-rpc-settings-changed"),
    );
    onSavedFlash?.();
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            Enable Discord Rich Presence
          </div>
          <div className="settings-row__desc">
            Connects to your local Discord desktop client and updates your
            activity automatically.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={enabled}
            onChange={(val) => {
              setEnabledState(val);
              persist({ enabled: val, showCover, showTimestamp, showButton });
            }}
            ariaLabel="Enable Discord Rich Presence"
          />
        </div>
      </div>

      <div className={`settings-row${!enabled ? " settings-row--disabled" : ""}`}>
        <div className="settings-row__info">
          <div className="settings-row__label">Show cover art</div>
          <div className="settings-row__desc">
            Uses the movie or series poster as the large image. When off, only
            the Lumen icon is shown.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={showCover}
            onChange={(val) => {
              setShowCover(val);
              persist({ enabled, showCover: val, showTimestamp, showButton });
            }}
            ariaLabel="Show cover art"
          />
        </div>
      </div>

      <div className={`settings-row${!enabled ? " settings-row--disabled" : ""}`}>
        <div className="settings-row__info">
          <div className="settings-row__label">Show elapsed time</div>
          <div className="settings-row__desc">
            Displays how long you've been on the current title's page.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={showTimestamp}
            onChange={(val) => {
              setShowTimestamp(val);
              persist({ enabled, showCover, showTimestamp: val, showButton });
            }}
            ariaLabel="Show elapsed time"
          />
        </div>
      </div>

      <div className={`settings-row${!enabled ? " settings-row--disabled" : ""}`}>
        <div className="settings-row__info">
          <div className="settings-row__label">Show GitHub button</div>
          <div className="settings-row__desc">
            Adds a button linking to the source repository on GitHub.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={showButton}
            onChange={(val) => {
              setShowButton(val);
              persist({ enabled, showCover, showTimestamp, showButton: val });
            }}
            ariaLabel="Show GitHub button"
          />
        </div>
      </div>
    </div>
  );
}

// ── Home Layout Card ──────────────────────────────────────────────────────────
function HomeLayoutCard() {
  const [order, setOrder] = useState(() => loadHomeLayout().order);
  const [visible, setVisible] = useState(() => loadHomeLayout().visible);
  const [viewMode, setViewMode] = useState(() => loadHomeViewMode());
  const [saved, setSaved] = useState(false);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const rowLabels = useMemo(
    () => Object.fromEntries(HOME_ROWS.map((r) => [r.id, r.label])),
    [],
  );

  const handleDragStart = (idx) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx) => {
    dragOver.current = idx;
  };

  const handleDragEnd = () => {
    if (
      dragItem.current === null ||
      dragOver.current === null ||
      dragItem.current === dragOver.current
    ) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const next = [...order];
    const [dragged] = next.splice(dragItem.current, 1);
    next.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    setOrder(next);
  };

  const moveRow = (idx, delta) => {
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    setOrder(next);
  };

  const toggleVisible = (id) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.HOME_ROW_ORDER, order);
    storage.set(STORAGE_KEYS.HOME_ROW_VISIBLE, visible);
    saveHomeViewMode(viewMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Row display style</div>
          <div className="settings-row__desc">
            Choose between scrollable horizontal rows or a compact multi-row
            grid.
          </div>
        </div>
        <div className="settings-row__control">
          <div className="lumen-segmented" role="group" aria-label="Row display style">
            {[
              { value: "carousel", label: "Rows" },
              { value: "list", label: "Grid" },
            ].map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setViewMode(opt.value)}
                className={`lumen-segmented__btn${viewMode === opt.value ? " lumen-segmented__btn--active" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-row settings-row--stack">
        <div className="settings-row__info">
          <div className="settings-row__label">Home page rows</div>
          <div className="settings-row__desc">
            Drag rows or use the arrows to reorder. Toggle visibility for each
            row; the hero banner always stays on top.
          </div>
        </div>

        <div className="settings-home-list">
          {order.map((id, idx) => (
            <div
              key={id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`settings-home-row${!visible[id] ? " settings-home-row--hidden" : ""}`}
            >
              <span className="settings-home-row__grip" aria-hidden="true">
                <GripVerticalIcon size={15} />
              </span>
              <span className="settings-home-row__label">
                {rowLabels[id] || id}
              </span>
              <div className="settings-home-row__move">
                <button
                  type="button"
                  className="settings-icon-mini"
                  disabled={idx === 0}
                  onClick={() => moveRow(idx, -1)}
                  title="Move up"
                  aria-label={`Move ${rowLabels[id] || id} up`}
                >
                  <ArrowUpIcon size={13} />
                </button>
                <button
                  type="button"
                  className="settings-icon-mini"
                  disabled={idx === order.length - 1}
                  onClick={() => moveRow(idx, 1)}
                  title="Move down"
                  aria-label={`Move ${rowLabels[id] || id} down`}
                >
                  <ArrowDownIcon size={13} />
                </button>
              </div>
              <Toggle
                value={!!visible[id]}
                onChange={() => toggleVisible(id)}
                title={visible[id] ? "Hide row" : "Show row"}
                ariaLabel={`${visible[id] ? "Hide" : "Show"} ${rowLabels[id] || id} row`}
              />
            </div>
          ))}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary btn--sm"
            onClick={handleSave}
          >
            Save layout
          </button>
          <SavedIndicator show={saved} />
        </div>
      </div>
    </div>
  );
}

// ── Start Page Card ───────────────────────────────────────────────────────────
function StartPageCard() {
  const [startPage, setStartPage] = useState(
    () => storage.get(STORAGE_KEYS.START_PAGE) || "home",
  );
  const [saved, setSaved] = useState(false);

  const handleChange = (val) => {
    setStartPage(val);
    storage.set(STORAGE_KEYS.START_PAGE, val);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>Start page</span>
            <SavedIndicator show={saved} />
          </div>
          <div className="settings-row__desc">
            Choose which page opens when you launch Lumen.
          </div>
        </div>
        <div className="settings-row__control">
          <SettingsSelect
            value={startPage}
            onChange={handleChange}
            options={[
              { value: "home", label: "Home" },
              { value: "movies", label: "Movies" },
              { value: "series", label: "Series" },
              { value: "history", label: "Library" },
              { value: "downloads", label: "Downloads" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// ── Appearance Card ───────────────────────────────────────────────────────────
function AppearanceCard() {
  const [accent, setAccent] = useState(
    () => storage.get(STORAGE_KEYS.ACCENT_COLOR) || "red",
  );
  const [fontSize, setFontSize] = useState(
    () => storage.get(STORAGE_KEYS.FONT_SIZE) || "normal",
  );
  const [compact, setCompact] = useState(
    () => !!storage.get(STORAGE_KEYS.COMPACT_MODE),
  );
  const [noAnim, setNoAnim] = useState(
    () => !!storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS),
  );
  const [gamepadEnabled, setGamepadEnabled] = useState(
    () => storage.get(STORAGE_KEYS.GAMEPAD_ENABLED) !== false,
  );
  const [accentInPlayer, setAccentInPlayer] = useState(
    () => storage.get(STORAGE_KEYS.ACCENT_IN_PLAYER) !== false,
  );
  const [theme, setTheme] = useState(
    () => storage.get(STORAGE_KEYS.THEME) || "dark",
  );
  const [customVars, setCustomVars] = useState(
    () =>
      storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || { ...DEFAULT_CUSTOM_VARS },
  );
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const committedRef = useRef({
    accent: storage.get(STORAGE_KEYS.ACCENT_COLOR) || "red",
    theme: storage.get(STORAGE_KEYS.THEME) || "dark",
    fontSize, compact, noAnim, gamepadEnabled, accentInPlayer,
    customVars: storage.get(STORAGE_KEYS.CUSTOM_THEME_VARS) || {
      ...DEFAULT_CUSTOM_VARS,
    },
  });
  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Revert any unsaved theme/accent live preview when navigating away
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const c = committedRef.current;
        applyAccentColor(c.accent);
        applyTheme(c.theme, c.theme === "custom" ? c.customVars : null);
      }
    };
  }, []);

  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
    setSaved(false);
  };

  const handleThemeSelect = (id) => {
    setTheme(id);
    markDirty();
    if (id !== "custom") {
      applyTheme(id);
    } else {
      applyTheme("custom", customVars);
      setShowCustomEditor(true);
    }
  };

  const handleCustomVarChange = (prop, value) => {
    const next = { ...customVars, [prop]: value };
    setCustomVars(next);
    markDirty();
    applyTheme("custom", next);
  };

  const handleRevert = () => {
    const c = committedRef.current;
    setAccent(c.accent);
    setTheme(c.theme);
    setCustomVars(c.customVars);
    setFontSize(c.fontSize);
    setCompact(c.compact);
    setNoAnim(c.noAnim);
    setGamepadEnabled(c.gamepadEnabled);
    setAccentInPlayer(c.accentInPlayer);
    applyAccentColor(c.accent);
    applyTheme(c.theme, c.theme === "custom" ? c.customVars : null);
    setDirty(false);
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.ACCENT_COLOR, accent);
    storage.set(STORAGE_KEYS.ACCENT_IN_PLAYER, accentInPlayer);
    storage.set(STORAGE_KEYS.FONT_SIZE, fontSize);
    storage.set(STORAGE_KEYS.COMPACT_MODE, compact ? 1 : 0);
    storage.set(STORAGE_KEYS.REDUCE_ANIMATIONS, noAnim ? 1 : 0);
    storage.set(STORAGE_KEYS.GAMEPAD_ENABLED, gamepadEnabled);
    window.dispatchEvent(new CustomEvent("streambert:gamepad-settings-changed"));
    storage.set(STORAGE_KEYS.THEME, theme);
    if (theme === "custom") {
      storage.set(STORAGE_KEYS.CUSTOM_THEME_VARS, customVars);
    }

    applyAccentColor(accent);
    applyTheme(theme, theme === "custom" ? customVars : null);
    const zoomMap = { sm: 0.85, normal: 1, lg: 1.15 };
    if (window.electron?.setZoomFactor) {
      window.electron.setZoomFactor(zoomMap[fontSize] ?? 1);
    }
    document.body.classList.toggle("compact-mode", compact);
    document.body.classList.toggle("no-anim", noAnim);

    committedRef.current = {
      accent, theme, customVars, fontSize, compact, noAnim,
      gamepadEnabled, accentInPlayer,
    };
    setDirty(false);
    window.dispatchEvent(new CustomEvent("streambert:player-settings-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-card">
      {/* Theme */}
      <div className="settings-row settings-row--stack">
        <div className="settings-row__info">
          <div className="settings-row__label">Theme</div>
          <div className="settings-row__desc">
            {THEME_PRESETS.find((t) => t.id === theme)?.description}
          </div>
        </div>

        <div className="settings-theme-grid">
          {THEME_PRESETS.map((t) => {
            const vars = t.id === "custom" ? customVars : t.vars;
            const bg = vars?.["--bg"] || "#141416";
            const sf = vars?.["--surface2"] || "#232327";
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => handleThemeSelect(t.id)}
                title={t.description}
                className={`settings-theme-card${theme === t.id ? " settings-theme-card--active" : ""}`}
              >
                <div
                  className="settings-theme-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${bg} 50%, ${sf} 50%)`,
                  }}
                />
                <span className="settings-theme-label">{t.label}</span>
              </button>
            );
          })}
        </div>

        {theme === "custom" && (
          <div>
            <button
              type="button"
              className="btn btn-ghost btn--sm"
              onClick={() => setShowCustomEditor((v) => !v)}
            >
              {showCustomEditor ? "Hide custom colours" : "Edit custom colours"}
            </button>

            {showCustomEditor && (
              <div className="settings-custom-vars" style={{ marginTop: 12 }}>
                {Object.entries(CUSTOM_VAR_LABELS).map(([prop, label]) => (
                  <div key={prop} className="settings-color-field">
                    <input
                      type="color"
                      className="settings-color-input"
                      value={customVars[prop] || "#0e0e10"}
                      onChange={(e) =>
                        handleCustomVarChange(prop, e.target.value)
                      }
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--text)",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text3)",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {customVars[prop]}
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn--sm"
                    onClick={() => {
                      setCustomVars({ ...DEFAULT_CUSTOM_VARS });
                      markDirty();
                      applyTheme("custom", DEFAULT_CUSTOM_VARS);
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accent Colour */}
      <div className="settings-row settings-row--stack">
        <div className="settings-row__info">
          <div className="settings-row__label">Accent colour</div>
          <div className="settings-row__desc">
            {ACCENT_PRESETS.find((p) => p.id === accent)?.label} — applied to
            primary buttons, active states, and progress indicators.
          </div>
        </div>
        <div className="settings-swatch-row">
          {ACCENT_PRESETS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                setAccent(p.id);
                markDirty();
                applyAccentColor(p.id);
              }}
              title={p.label}
              aria-label={p.label}
              className={`settings-swatch${accent === p.id ? " settings-swatch--active" : ""}`}
              style={{ background: p.color }}
            />
          ))}
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            Apply accent colour to streaming player
          </div>
          <div className="settings-row__desc">
            Passes the selected accent colour to Videasy and Vidking. VidSrc
            does not support colour theming.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={accentInPlayer}
            onChange={(v) => {
              setAccentInPlayer(v);
              markDirty();
            }}
            ariaLabel="Apply accent colour to streaming player"
          />
        </div>
      </div>

      {/* Font Size */}
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Interface scale</div>
          <div className="settings-row__desc">
            Adjusts overall text and layout zoom across the app.
          </div>
        </div>
        <div className="settings-row__control">
          <div className="lumen-segmented" role="group" aria-label="Interface scale">
            {[
              { id: "sm", label: "Small" },
              { id: "normal", label: "Normal" },
              { id: "lg", label: "Large" },
            ].map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => {
                  setFontSize(o.id);
                  markDirty();
                }}
                className={`lumen-segmented__btn${fontSize === o.id ? " lumen-segmented__btn--active" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Compact card grid</div>
          <div className="settings-row__desc">
            Shows more titles per row by reducing poster card size.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={compact}
            onChange={(v) => {
              setCompact(v);
              markDirty();
            }}
            ariaLabel="Compact card grid"
          />
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Reduce animations</div>
          <div className="settings-row__desc">
            Disables transitions and hover motion throughout the app.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={noAnim}
            onChange={(v) => {
              setNoAnim(v);
              markDirty();
            }}
            ariaLabel="Reduce animations"
          />
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Controller support</div>
          <div className="settings-row__desc">
            Navigate menus with a D-pad or stick, and control playback with
            A/B/LB/RB/Y.
          </div>
        </div>
        <div className="settings-row__control">
          <Toggle
            value={gamepadEnabled}
            onChange={(v) => {
              setGamepadEnabled(v);
              markDirty();
            }}
            ariaLabel="Controller support"
          />
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary btn--sm"
            onClick={handleSave}
          >
            Save appearance
          </button>
          {dirty && (
            <button
              type="button"
              className="btn btn-ghost btn--sm"
              onClick={handleRevert}
            >
              Revert changes
            </button>
          )}
          <SavedIndicator show={saved} />
        </div>
      </div>
    </div>
  );
}

// ── Library & Privacy Section ─────────────────────────────────────────────────
function LibraryPrivacySection({ onSavedFlash }) {
  const [sort, setSort] = useState(
    () => storage.get(STORAGE_KEYS.LIBRARY_SORT) || "manual",
  );
  const [historyEnabled, setHistoryEnabled] = useState(() => {
    const v = storage.get(STORAGE_KEYS.HISTORY_ENABLED);
    return v === 0 || v === false ? false : true;
  });

  const SORT_OPTIONS = [
    { value: "manual", label: "Custom order" },
    { value: "title", label: "Title A–Z" },
    { value: "rating", label: "Top rated" },
    { value: "year", label: "Newest first" },
  ];

  const updateSort = (val) => {
    setSort(val);
    storage.set(STORAGE_KEYS.LIBRARY_SORT, val);
    window.dispatchEvent(
      new CustomEvent("streambert:library-sort-changed", { detail: val }),
    );
    onSavedFlash?.();
  };

  const updateHistory = (val) => {
    setHistoryEnabled(val);
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, val ? 1 : 0);
    onSavedFlash?.();
  };

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">Watchlist sort order</div>
          <div className="settings-row__desc">
            "Custom order" preserves your drag-and-drop arrangement in the
            sidebar.
          </div>
        </div>
        <div className="settings-row__control">
          <SettingsSelect
            value={sort}
            onChange={updateSort}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      <div className="settings-row settings-row--stack">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div className="settings-row__info">
            <div className="settings-row__label">Record watch history</div>
            <div className="settings-row__desc">
              When off, nothing you watch is added to History or Continue
              watching.
            </div>
          </div>
          <div className="settings-row__control">
            <Toggle
              value={historyEnabled}
              onChange={updateHistory}
              ariaLabel="Record watch history"
            />
          </div>
        </div>

        {!historyEnabled && (
          <div className="lumen-callout lumen-callout--danger">
            <WarningIcon size={15} />
            <span>
              Watch history is disabled. Progress tracking and Continue watching
              will not record new items.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Backup & Restore Section ──────────────────────────────────────────────────
function ScheduledBackupCard() {
  const [enabled, setEnabled] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const [keepCount, setKeepCount] = useState(5);
  const [frequency, setFrequency] = useState("startup");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    window.electron.getScheduledBackupSettings().then((s) => {
      if (s) {
        setEnabled(!!s.enabled);
        setBackupPath(s.path || "");
        setKeepCount(s.keepCount ?? 5);
        setFrequency(s.frequency || "startup");
      }
      setLoading(false);
    });
  }, []);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const persist = async (changes) => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const existing = await window.electron.getScheduledBackupSettings();
      const result = await window.electron.setScheduledBackupSettings({ ...existing, ...changes });
      if (!result?.ok) throw new Error(result?.error || "Couldn't save the backup schedule.");
      setEnabled(changes.enabled);
      flashSaved();
    } catch (error) {
      setSaveError({ type: "error", text: error.message || "Couldn't save the backup schedule." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (next) => {
    if (next) setEnabled(true);
    else persist({ enabled: false });
  };

  const pickFolder = async () => {
    if (!isElectron) return;
    const folder = await window.electron.pickFolder();
    if (folder) setBackupPath(folder);
  };

  const handleSave = () => persist({
    enabled: true,
    path: backupPath,
    keepCount: Math.max(1, Math.min(99, Number(keepCount) || 5)),
    frequency,
  });

  if (!isElectron || loading) return null;

  return (
    <div className="settings-card">
      <div className="settings-row">
        <div className="settings-row__info">
          <div className="settings-row__label">
            <span>Scheduled backups</span>
            <SavedIndicator show={saved} />
          </div>
          <div className="settings-row__desc">
            Automatically save a backup JSON file on a recurring schedule.
          </div>
          <StatusMessage status={saveError} />
        </div>
        <div className="settings-row__control">
          <Toggle
            value={enabled}
            onChange={handleToggle}
            ariaLabel="Scheduled backups"
            disabled={saving}
          />
        </div>
      </div>

      {enabled && (
        <>
          <div className="settings-row settings-row--stack">
            <div className="settings-row__label">Backup folder</div>
            <div className="settings-inline-row">
              <input
                className="lumen-input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="/home/you/Backups"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={pickFolder}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__info">
              <div className="settings-row__label">Frequency</div>
              <div className="settings-row__desc">
                How often automatic backups are created.
              </div>
            </div>
            <div className="settings-row__control">
              <SettingsSelect
                value={frequency}
                onChange={setFrequency}
                options={FREQUENCY_OPTIONS}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__info">
              <div className="settings-row__label">Keep last N backups</div>
              <div className="settings-row__desc">
                Older backup files are pruned automatically (1–99).
              </div>
            </div>
            <div className="settings-row__control">
              <input
                type="number"
                min={1}
                max={99}
                name="backupFilesToKeep"
                aria-label="Backup files to keep"
                className="lumen-input lumen-input--number"
                value={keepCount}
                onChange={(e) => setKeepCount(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-primary btn--sm"
                onClick={handleSave}
                disabled={saving}
              >
                Save schedule
              </button>
              <SavedIndicator show={saved} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BackupRestoreSection({ onRestored }) {
  const [restoreStatus, setRestoreStatus] = useState(null);

  const handleExport = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: collectBackupData(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streambert-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup?.data) {
          throw new Error("Invalid backup file, missing data field.");
        }
        restoreBackupData(backup.data);
        setRestoreStatus({ type: "ok", text: "Backup restored — reloading…" });
        setTimeout(() => window.location.reload(), 1200);
        onRestored?.();
      } catch (err) {
        setRestoreStatus({
          type: "error",
          text: err.message || "Could not read backup file.",
        });
        setTimeout(() => setRestoreStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="settings-stack">
      <div className="settings-card">
        <div className="settings-row settings-row--stack">
          <div className="settings-row__info">
            <div className="settings-row__label">Manual backup</div>
            <div className="settings-row__desc">
              Export your watchlist, watch history, progress, and settings to a
              JSON file, or restore from a previous export.
            </div>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="btn btn-primary btn--sm"
              onClick={handleExport}
            >
              <UploadIcon size={14} />
              Export backup
            </button>
            <label className="btn btn-secondary btn--sm" style={{ cursor: "pointer" }}>
              <DownloadIcon size={14} />
              Import backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                style={{ display: "none" }}
              />
            </label>
          </div>
          <StatusMessage status={restoreStatus} />
        </div>
      </div>

      <ScheduledBackupCard />
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function SettingsPage({
  apiKey,
  onChangeApiKey,
  initialSection,
}) {
  const [downloadPath, setDownloadPath] = useState(
    () => storage.get(STORAGE_KEYS.DOWNLOAD_PATH) || "",
  );
  const [dlPathSaved, setDlPathSaved] = useState(false);

  const [watchedThreshold, setWatchedThreshold] = useState(
    () => storage.get(STORAGE_KEYS.WATCHED_THRESHOLD) ?? 20,
  );
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const [introSkipMode, setIntroSkipMode] = useState(
    () => storage.get(STORAGE_KEYS.INTRO_SKIP_MODE) || "off",
  );
  const [introSaved, setIntroSaved] = useState(false);

  const [autoplayNextEnabled, setAutoplayNextEnabled] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED) ?? true,
  );
  const [autoplayNextDuration, setAutoplayNextDuration] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_DURATION) ?? 5,
  );
  const [autoplayNextLayout, setAutoplayNextLayout] = useState(
    () => storage.get(STORAGE_KEYS.AUTOPLAY_NEXT_LAYOUT) || "right",
  );
  const [autoplaySaved, setAutoplaySaved] = useState(false);

  const [heroTrailerEnabled, setHeroTrailerEnabled] = useState(
    () => storage.get(STORAGE_KEYS.HERO_TRAILER) !== false,
  );
  const [heroTrailerSaved, setHeroTrailerSaved] = useState(false);

  const [notifSaved, setNotifSaved] = useState(false);
  const [discordSaved, setDiscordSaved] = useState(false);
  const [librarySaved, setLibrarySaved] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showProgressConfirm, setShowProgressConfirm] = useState(false);
  const [showDeleteDlConfirm, setShowDeleteDlConfirm] = useState(false);
  const progressConfirmResolveRef = useRef(null);
  const deleteDlConfirmResolveRef = useRef(null);

  // Side nav & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(
    initialSection || SECTION_NAV[0].id,
  );
  const searchInputRef = useRef(null);
  const settingsNavRef = useRef(null);
  const [stickyNavHeight, setStickyNavHeight] = useState(0);

  useEffect(() => {
    const nav = settingsNavRef.current;
    if (!nav) return;
    const compactLayout = window.matchMedia("(max-width: 1100px)");
    const updateOffset = () => setStickyNavHeight(
      compactLayout.matches ? nav.getBoundingClientRect().height : 0,
    );
    const observer = new ResizeObserver(updateOffset);
    observer.observe(nav);
    compactLayout.addEventListener("change", updateOffset);
    updateOffset();
    return () => {
      observer.disconnect();
      compactLayout.removeEventListener("change", updateOffset);
    };
  }, []);

  useEffect(() => {
    const nav = settingsNavRef.current;
    const list = nav?.querySelector(".settings-nav__list");
    const item = nav?.querySelector('[aria-current="location"]');
    if (!list || !item || !stickyNavHeight) return;
    const bounds = list.getBoundingClientRect();
    const active = item.getBoundingClientRect();
    if (active.left < bounds.left) list.scrollLeft += active.left - bounds.left - 8;
    else if (active.right > bounds.right) list.scrollLeft += active.right - bounds.right + 8;
  }, [activeSection, stickyNavHeight]);

  const isMac =
    typeof navigator !== "undefined" &&
    /mac/i.test(navigator.platform || navigator.userAgent);

  // Section refs
  const secUpdates = useRef(null);
  const secContent = useRef(null);
  const secPlayback = useRef(null);
  const secSubtitles = useRef(null);
  const secDownloads = useRef(null);
  const secNotifications = useRef(null);
  const secDiscordRpc = useRef(null);
  const secInterface = useRef(null);
  const secLibrary = useRef(null);
  const secBackup = useRef(null);
  const secStorage = useRef(null);

  const sectionRefs = {
    updates: secUpdates,
    content: secContent,
    playback: secPlayback,
    subtitles: secSubtitles,
    downloads: secDownloads,
    notifications: secNotifications,
    discordRpc: secDiscordRpc,
    interface: secInterface,
    library: secLibrary,
    backup: secBackup,
    storage: secStorage,
  };

  // Age Rating
  const [ratingCountry, setRatingCountry] = useState(
    () => storage.get(STORAGE_KEYS.RATING_COUNTRY) || "US",
  );
  const [ageLimit, setAgeLimit] = useState(() => {
    const v = storage.get(STORAGE_KEYS.AGE_LIMIT);
    return v === null || v === undefined ? "" : String(v);
  });
  const [ageSaved, setAgeSaved] = useState(false);

  // Invidious
  const [invidiousBase, setInvidiousBase] = useState(
    () => storage.get(STORAGE_KEYS.INVIDIOUS_BASE) || DEFAULT_INVIDIOUS_BASE,
  );
  const [invidiousStatus, setInvidiousStatus] = useState(null);
  const [invidiousChecking, setInvidiousChecking] = useState(false);
  const [invidiousSaved, setInvidiousSaved] = useState(false);

  // Storage sizes
  const [sizes, setSizes] = useState({ cache: null, downloads: null });

  // Filtered sections
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return SECTION_NAV;
    return SECTION_NAV.filter(
      (s) =>
        s.label.toLowerCase().includes(normalizedQuery) ||
        s.subtitle.toLowerCase().includes(normalizedQuery) ||
        s.keywords.some((k) => k.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery]);
  const visibleIds = useMemo(
    () => new Set(visibleSections.map((s) => s.id)),
    [visibleSections],
  );
  const effectiveActiveSection = visibleIds.has(activeSection)
    ? activeSection
    : visibleSections[0]?.id;

  // Ctrl+K / Cmd+K focuses settings search; Esc clears it
  useEffect(() => {
    const handler = (e) => {
      if (getActiveModal()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current &&
        searchQuery
      ) {
        e.stopPropagation();
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchQuery]);

  // Scroll to initialSection when navigated from another page/modal
  useEffect(() => {
    if (!initialSection) return;
    setSearchQuery("");
    setActiveSection(initialSection);
    const t = setTimeout(() => {
      sectionRefs[initialSection]?.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  // Scrollspy over .main scroll container when not filtering
  useEffect(() => {
    if (normalizedQuery) return;
    const scrollRoot = document.querySelector(".main") || null;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          const id = intersecting[0].target.getAttribute("data-section-id");
          if (id) setActiveSection(id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: `-${stickyNavHeight + 20}px 0px -45% 0px`,
        threshold: 0,
      },
    );

    Object.entries(sectionRefs).forEach(([, ref]) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery, stickyNavHeight]);

  // Load cache & downloads sizes
  useEffect(() => {
    if (typeof window === "undefined" || !window.electron) {
      setSizes({ cache: -1, downloads: -1 });
      return;
    }
    (async () => {
      try {
        const [cacheRes, downloadsRes] = await Promise.all([
          window.electron.getCacheSize?.() ?? null,
          window.electron.getDownloadsSize?.() ?? null,
        ]);
        setSizes({
          cache: cacheRes?.bytes ?? -1,
          downloads: downloadsRes?.bytes ?? -1,
        });
      } catch {
        setSizes({ cache: -1, downloads: -1 });
      }
    })();
  }, []);

  const scrollToSection = (id) => {
    setActiveSection(id);
    if (normalizedQuery && !visibleIds.has(id)) {
      setSearchQuery("");
    }
    setTimeout(() => {
      sectionRefs[id]?.current?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 20);
  };

  const flashFlag = (setter) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const saveAgeSettings = () => {
    storage.set(STORAGE_KEYS.RATING_COUNTRY, ratingCountry);
    if (ageLimit === "" || ageLimit === null) {
      storage.remove(STORAGE_KEYS.AGE_LIMIT);
    } else {
      storage.set(STORAGE_KEYS.AGE_LIMIT, Number(ageLimit));
    }
    flashFlag(setAgeSaved);
  };

  const checkInvidious = async (baseUrl) => {
    const clean = (baseUrl || "").trim().replace(/\/$/, "");
    if (!clean) {
      setInvidiousStatus({ ok: false, msg: "Please enter a URL first." });
      return;
    }
    setInvidiousChecking(true);
    setInvidiousStatus(null);
    try {
      const res = await fetch(`${clean}/api/v1/stats`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        setInvidiousStatus({
          ok: true,
          msg: "Instance reachable and responding.",
        });
      } else {
        setInvidiousStatus({
          ok: false,
          msg: `Server responded with status ${res.status}.`,
        });
      }
    } catch {
      setInvidiousStatus({
        ok: false,
        msg: "Could not reach instance. Check the URL or try another.",
      });
    } finally {
      setInvidiousChecking(false);
    }
  };

  const saveInvidiousBase = () => {
    const clean = (invidiousBase || "").trim().replace(/\/$/, "");
    storage.set(STORAGE_KEYS.INVIDIOUS_BASE, clean || DEFAULT_INVIDIOUS_BASE);
    setInvidiousBase(clean || DEFAULT_INVIDIOUS_BASE);
    flashFlag(setInvidiousSaved);
  };

  const pickFolder = async () => {
    if (!isElectron) return;
    const folder = await window.electron.pickFolder();
    if (folder) {
      setDownloadPath(folder);
      storage.set(STORAGE_KEYS.DOWNLOAD_PATH, folder);
      flashFlag(setDlPathSaved);
    }
  };

  const handleSavePath = () => {
    storage.set(STORAGE_KEYS.DOWNLOAD_PATH, downloadPath.trim());
    setDownloadPath(downloadPath.trim());
    flashFlag(setDlPathSaved);
  };

  const handleSaveThreshold = () => {
    const val = Math.max(1, Math.min(300, Number(watchedThreshold) || 20));
    setWatchedThreshold(val);
    storage.set(STORAGE_KEYS.WATCHED_THRESHOLD, val);
    flashFlag(setThresholdSaved);
  };

  const handleClearCache = async () => {
    await clearAppCaches();
    setSizes((prev) => ({ ...prev, cache: 0 }));
    return { msg: "Cache cleared successfully" };
  };

  const handleClearWatchProgress = async () => {
    storage.remove(STORAGE_KEYS.WATCH_PROGRESS);
    storage.remove(STORAGE_KEYS.HISTORY);
    storage.remove(STORAGE_KEYS.WATCHED);
    if (isElectron) await window.electron.clearWatchData();
    setTimeout(() => window.location.reload(), 800);
    return { msg: "Watch data cleared" };
  };

  const handleDeleteAllDownloads = async () => {
    let msg = "All downloads removed";
    setSizes((prev) => ({ ...prev, downloads: 0 }));
    if (isElectron) {
      const res = await window.electron.deleteAllDownloads();
      if (res?.deleted != null) {
        msg = `Removed ${res.deleted} file${res.deleted !== 1 ? "s" : ""}`;
        if (res.errors > 0) msg += ` (${res.errors} could not be deleted)`;
      }
    } else {
      storage.remove(STORAGE_KEYS.LOCAL_FILES);
    }
    return { msg };
  };

  const handleResetApp = async () => {
    setShowResetConfirm(false);
    if (isElectron) await window.electron.resetApp();
    storage.clearAll();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("dlDur_")) localStorage.removeItem(key);
    }
    window.location.reload();
  };

  const sectionMeta = Object.fromEntries(SECTION_NAV.map((s) => [s.id, s]));

  return (
    <>
      {showProgressConfirm && (
        <ConfirmDialog
          title="Clear watch progress?"
          description="This will permanently delete all watch history, continue-watching progress, and watched markings for all movies and series."
          confirmLabel="Clear everything"
          onConfirm={async () => {
            setShowProgressConfirm(false);
            await handleClearWatchProgress();
            progressConfirmResolveRef.current?.({ msg: "Watch data cleared" });
            progressConfirmResolveRef.current = null;
          }}
          onCancel={() => {
            setShowProgressConfirm(false);
            progressConfirmResolveRef.current?.({ cancelled: true });
            progressConfirmResolveRef.current = null;
          }}
        />
      )}

      {showDeleteDlConfirm && (
        <ConfirmDialog
          title="Delete all downloads?"
          description="This will permanently delete all video files downloaded through Lumen and remove them from your download list."
          confirmLabel="Delete all"
          onConfirm={async () => {
            setShowDeleteDlConfirm(false);
            const result = await handleDeleteAllDownloads();
            deleteDlConfirmResolveRef.current?.(result);
            deleteDlConfirmResolveRef.current = null;
          }}
          onCancel={() => {
            setShowDeleteDlConfirm(false);
            deleteDlConfirmResolveRef.current?.({ cancelled: true });
            deleteDlConfirmResolveRef.current = null;
          }}
        />
      )}

      {showResetConfirm && (
        <ConfirmDialog
          title="Reset Lumen?"
          description={
            <>
              This will permanently delete all your settings, watch history,
              saved titles, progress data, and cached data. Your downloaded video
              files will <strong style={{ color: "var(--text)" }}>not</strong>{" "}
              be deleted.
            </>
          }
          confirmLabel="Reset everything"
          onConfirm={handleResetApp}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      <div
        className="settings-shell fade-in"
        style={{ "--settings-scroll-offset": `${stickyNavHeight ? stickyNavHeight + 24 : 28}px` }}
      >
        {/* ── Sticky left navigation & search ── */}
        <aside ref={settingsNavRef} className="settings-nav" aria-label="Settings sections">
          <h1 className="settings-nav__title">Settings</h1>

          <div className="settings-nav__search">
            <SearchIcon size={14} />
            <input
              ref={searchInputRef}
              type="text"
              name="settingsFilter"
              className="settings-nav__search-input"
              placeholder="Filter settings…"
              aria-label="Filter settings"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="settings-nav__search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <CloseIcon size={13} />
              </button>
            ) : (
              <kbd className="settings-nav__kbd">{isMac ? "⌘K" : "Ctrl+K"}</kbd>
            )}
          </div>

          <div className="settings-nav__list">
            {visibleSections.map((s) => {
                const isActive = effectiveActiveSection === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`settings-nav__item${isActive ? " settings-nav__item--active" : ""}`}
                    aria-current={isActive ? "location" : undefined}
                    aria-controls={`settings-${s.id}`}
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </button>
                );
              })}
          </div>
        </aside>

        {/* ── Right settings content ── */}
        <div className="settings-content">
          {normalizedQuery && (
            <div className="settings-filter-bar">
              <span role="status">
                Showing {visibleSections.length} of {SECTION_NAV.length} sections
                for “{searchQuery.trim()}”
              </span>
              <button
                type="button"
                className="btn btn-ghost btn--sm"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </button>
            </div>
          )}

          {visibleSections.length === 0 && (
            <div className="empty-state" style={{ paddingTop: 48 }}>
              <SearchIcon />
              <h3>No settings match “{searchQuery.trim()}”</h3>
              <p>Try another keyword, or clear the filter to view all settings.</p>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                style={{ marginTop: 12 }}
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            </div>
          )}

          {/* ── GENERAL ── */}
          <section
              id="settings-updates"
              hidden={!visibleIds.has("updates")}
              ref={secUpdates}
              data-section-id="updates"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.updates.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.updates.subtitle}
                  </p>
                </div>
              </div>

              <div className="settings-stack">
                <VersionCard />

                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        TMDB Read Access Token
                      </div>
                      <div className="settings-row__desc">
                        Used to fetch movie and TV metadata, posters, ratings,
                        and cast info from The Movie Database.
                      </div>
                    </div>
                    <div className="settings-row__control">
                      <code className="settings-code-pill">
                        {apiKey
                          ? apiKey.slice(0, 8) + "••••••••••••"
                          : "(not set)"}
                      </code>
                      <button
                        type="button"
                        className="btn btn-secondary btn--sm"
                        onClick={onChangeApiKey}
                      >
                        Change API token
                      </button>
                    </div>
                  </div>
                </div>

                <TmdbLanguageCard />
              </div>
            </section>

          {/* ── AGE RATING ── */}
          <section
              id="settings-content"
              hidden={!visibleIds.has("content")}
              ref={secContent}
              data-section-id="content"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.content.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.content.subtitle}
                  </p>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row__info">
                    <div className="settings-row__label">Rating country</div>
                    <div className="settings-row__desc">
                      Certification system used when evaluating age ratings.
                    </div>
                  </div>
                  <div className="settings-row__control">
                    <SettingsSelect
                      value={ratingCountry}
                      onChange={setRatingCountry}
                      options={RATING_COUNTRIES.map((c) => ({
                        value: c.code,
                        label: c.label,
                      }))}
                    />
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row__info">
                    <div className="settings-row__label">
                      Maximum allowed age rating
                    </div>
                    <div className="settings-row__desc">
                      Titles rated above this limit remain visible, but playback
                      is blocked.
                    </div>
                  </div>
                  <div className="settings-row__control">
                    <SettingsSelect
                      value={ageLimit}
                      onChange={setAgeLimit}
                      options={AGE_LIMIT_OPTIONS}
                    />
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn--sm"
                      onClick={saveAgeSettings}
                    >
                      Save
                    </button>
                    <SavedIndicator show={ageSaved} />
                  </div>
                </div>
              </div>
            </section>

          {/* ── PLAYBACK ── */}
          <section
              id="settings-playback"
              hidden={!visibleIds.has("playback")}
              ref={secPlayback}
              data-section-id="playback"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.playback.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.playback.subtitle}
                  </p>
                </div>
              </div>

              <div className="settings-stack">
                {/* Invidious */}
                <div className="settings-card">
                  <div className="settings-row settings-row--stack">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        <span>Invidious instance</span>
                        <SavedIndicator show={invidiousSaved} />
                      </div>
                      <div className="settings-row__desc">
                        Trailers play via Invidious. Your configured instance is
                        tried first, with automatic fallback if unreachable.
                        Default: <code>{DEFAULT_INVIDIOUS_BASE}</code>.
                      </div>
                    </div>

                    <div className="settings-inline-row">
                      <input
                        className="lumen-input"
                        style={{ flex: 1, minWidth: 220 }}
                        placeholder={DEFAULT_INVIDIOUS_BASE}
                        value={invidiousBase}
                        onChange={(e) => {
                          setInvidiousBase(e.target.value);
                          setInvidiousStatus(null);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn--sm"
                        disabled={invidiousChecking}
                        onClick={() => checkInvidious(invidiousBase)}
                      >
                        {invidiousChecking ? "Checking…" : "Test"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn--sm"
                        onClick={saveInvidiousBase}
                      >
                        Save
                      </button>
                    </div>

                    {invidiousStatus && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          fontWeight: 500,
                          color: invidiousStatus.ok
                            ? "var(--success)"
                            : "var(--red)",
                        }}
                      >
                        <span
                          className={`settings-status-dot ${invidiousStatus.ok ? "settings-status-dot--ok" : "settings-status-dot--err"}`}
                        />
                        <span>{invidiousStatus.msg}</span>
                      </div>
                    )}
                  </div>

                  <div className="settings-row">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        <span>Auto-play hero trailers</span>
                        <SavedIndicator show={heroTrailerSaved} />
                      </div>
                      <div className="settings-row__desc">
                        Plays a muted trailer preview behind the Home page hero
                        banner after a short pause. Automatically disabled when
                        Reduce animations is on.
                      </div>
                    </div>
                    <div className="settings-row__control">
                      <Toggle
                        value={heroTrailerEnabled}
                        onChange={(val) => {
                          setHeroTrailerEnabled(val);
                          storage.set(STORAGE_KEYS.HERO_TRAILER, val);
                          flashFlag(setHeroTrailerSaved);
                        }}
                        ariaLabel="Auto-play hero trailers"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-watched threshold */}
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        <span>Auto-watched threshold</span>
                        <SavedIndicator show={thresholdSaved} />
                      </div>
                      <div className="settings-row__desc">
                        Automatically marks a movie or episode as watched when
                        remaining playback time drops to this many seconds
                        (1–300).
                      </div>
                    </div>
                    <div className="settings-row__control">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        name="watchedThresholdSeconds"
                        aria-label="Watched threshold in seconds"
                        className="lumen-input lumen-input--number"
                        value={watchedThreshold}
                        onChange={(e) => setWatchedThreshold(e.target.value)}
                      />
                      <span style={{ fontSize: 13, color: "var(--text3)" }}>
                        sec
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary btn--sm"
                        onClick={handleSaveThreshold}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Autoplay Next Episode */}
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        <span>Autoplay next episode</span>
                        <SavedIndicator show={autoplaySaved} />
                      </div>
                      <div className="settings-row__desc">
                        Automatically queue and play the next episode when the
                        current one ends.
                      </div>
                    </div>
                    <div className="settings-row__control">
                      <Toggle
                        value={autoplayNextEnabled}
                        onChange={(val) => {
                          setAutoplayNextEnabled(val);
                          storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED, val);
                          flashFlag(setAutoplaySaved);
                        }}
                        ariaLabel="Autoplay next episode"
                      />
                    </div>
                  </div>

                  {autoplayNextEnabled && (
                    <>
                      <div className="settings-row">
                        <div className="settings-row__info">
                          <div className="settings-row__label">
                            Countdown duration
                          </div>
                          <div className="settings-row__desc">
                            Seconds before advancing (0–60). Set to 0 to show
                            buttons without auto-advancing.
                          </div>
                        </div>
                        <div className="settings-row__control">
                          <input
                            type="number"
                            min={0}
                            max={60}
                            name="autoplayNextCountdownSeconds"
                            aria-label="Autoplay next episode countdown in seconds"
                            className="lumen-input lumen-input--number"
                            value={autoplayNextDuration}
                            onChange={(e) =>
                              setAutoplayNextDuration(e.target.value)
                            }
                            onBlur={() => {
                              const num = Math.max(
                                0,
                                Math.min(
                                  60,
                                  parseInt(autoplayNextDuration, 10) || 0,
                                ),
                              );
                              setAutoplayNextDuration(num);
                              storage.set(
                                STORAGE_KEYS.AUTOPLAY_NEXT_DURATION,
                                num,
                              );
                              flashFlag(setAutoplaySaved);
                            }}
                          />
                          <span style={{ fontSize: 13, color: "var(--text3)" }}>
                            sec
                          </span>
                        </div>
                      </div>

                      <div className="settings-row">
                        <div className="settings-row__info">
                          <div className="settings-row__label">
                            Overlay position
                          </div>
                          <div className="settings-row__desc">
                            Which corner of the player displays the next episode
                            card.
                          </div>
                        </div>
                        <div className="settings-row__control">
                          <SettingsSelect
                            value={autoplayNextLayout}
                            onChange={(val) => {
                              setAutoplayNextLayout(val);
                              storage.set(
                                STORAGE_KEYS.AUTOPLAY_NEXT_LAYOUT,
                                val,
                              );
                              flashFlag(setAutoplaySaved);
                            }}
                            options={[
                              { value: "left", label: "Left side" },
                              { value: "right", label: "Right side" },
                            ]}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Anime Intro Skip */}
                <div className="settings-card settings-card--clip">
                  <div className="settings-row">
                    <div className="settings-row__info">
                      <div className="settings-row__label">
                        <span>Anime intro skip</span>
                        <SavedIndicator show={introSaved} />
                      </div>
                      <div className="settings-row__desc">
                        Uses AniSkip to detect opening and ending segments for
                        anime played via HiAnime.
                      </div>
                    </div>
                  </div>
                  {[
                    {
                      value: "off",
                      label: "Off",
                      desc: "Intro skip is disabled.",
                    },
                    {
                      value: "auto",
                      label: "Auto skip",
                      desc: "Automatically jumps past the intro or outro when reached.",
                    },
                    {
                      value: "manual",
                      label: "Manual skip",
                      desc: 'Shows a "Skip intro" button at the bottom of the player.',
                    },
                  ].map((opt) => {
                    const active = introSkipMode === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        className="settings-radio-item"
                        onClick={() => {
                          setIntroSkipMode(opt.value);
                          storage.set(STORAGE_KEYS.INTRO_SKIP_MODE, opt.value);
                          flashFlag(setIntroSaved);
                        }}
                      >
                        <span
                          className={`settings-radio-dot${active ? " settings-radio-dot--active" : ""}`}
                        >
                          {active && <span className="settings-radio-dot__inner" />}
                        </span>
                        <span className="settings-row__info">
                          <span className="settings-row__label">
                            {opt.label}
                          </span>
                          <span className="settings-row__desc">{opt.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

          {/* ── SUBTITLES ── */}
          <section
              id="settings-subtitles"
              hidden={!visibleIds.has("subtitles")}
              ref={secSubtitles}
              data-section-id="subtitles"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.subtitles.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.subtitles.subtitle}
                  </p>
                </div>
              </div>
              <SubtitleSettingsSection />
            </section>

          {/* ── DOWNLOADS ── */}
          <section
              id="settings-downloads"
              hidden={!visibleIds.has("downloads")}
              ref={secDownloads}
              data-section-id="downloads"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.downloads.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.downloads.subtitle}
                  </p>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-row settings-row--stack">
                  <div className="settings-row__info">
                    <div className="settings-row__label">
                      <span>Download folder</span>
                      <SavedIndicator show={dlPathSaved} />
                    </div>
                    <div className="settings-row__desc">
                      Downloaded videos are saved here. Make sure the folder
                      exists and Lumen has write permission.
                    </div>
                  </div>

                  <div className="settings-inline-row">
                    <input
                      className="lumen-input"
                      style={{ flex: 1, minWidth: 220 }}
                      placeholder="/home/you/Movies"
                      value={downloadPath}
                      onChange={(e) => setDownloadPath(e.target.value)}
                    />
                    {isElectron && (
                      <button
                        type="button"
                        className="btn btn-secondary btn--sm"
                        onClick={pickFolder}
                      >
                        Browse
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn--sm"
                      onClick={handleSavePath}
                    >
                      Save
                    </button>
                  </div>

                  {!downloadPath && (
                    <div className="lumen-callout lumen-callout--danger">
                      <WarningIcon size={15} />
                      <span>
                        No download folder set — videos cannot be downloaded
                        until you choose one.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

          {/* ── NOTIFICATIONS ── */}
          <section
              id="settings-notifications"
              hidden={!visibleIds.has("notifications")}
              ref={secNotifications}
              data-section-id="notifications"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.notifications.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.notifications.subtitle}
                  </p>
                </div>
                <SavedIndicator show={notifSaved} />
              </div>
              <NotificationsSection
                onSavedFlash={() => flashFlag(setNotifSaved)}
              />
            </section>

          {/* ── DISCORD RICH PRESENCE ── */}
          <section
              id="settings-discordRpc"
              hidden={!visibleIds.has("discordRpc")}
              ref={secDiscordRpc}
              data-section-id="discordRpc"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.discordRpc.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.discordRpc.subtitle}
                  </p>
                </div>
                <SavedIndicator show={discordSaved} />
              </div>
              <DiscordRpcSection
                onSavedFlash={() => flashFlag(setDiscordSaved)}
              />
            </section>

          {/* ── INTERFACE ── */}
          <section
              id="settings-interface"
              hidden={!visibleIds.has("interface")}
              ref={secInterface}
              data-section-id="interface"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.interface.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.interface.subtitle}
                  </p>
                </div>
              </div>
              <div className="settings-stack">
                <HomeLayoutCard />
                <StartPageCard />
                <AppearanceCard />
              </div>
            </section>

          {/* ── LIBRARY ── */}
          <section
              id="settings-library"
              hidden={!visibleIds.has("library")}
              ref={secLibrary}
              data-section-id="library"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.library.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.library.subtitle}
                  </p>
                </div>
                <SavedIndicator show={librarySaved} />
              </div>
              <LibraryPrivacySection
                onSavedFlash={() => flashFlag(setLibrarySaved)}
              />
            </section>

          {/* ── BACKUP & RESTORE ── */}
          <section
              id="settings-backup"
              hidden={!visibleIds.has("backup")}
              ref={secBackup}
              data-section-id="backup"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.backup.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.backup.subtitle}
                  </p>
                </div>
              </div>
              <BackupRestoreSection />
            </section>

          {/* ── STORAGE & DATA ── */}
          <section
              id="settings-storage"
              hidden={!visibleIds.has("storage")}
              ref={secStorage}
              data-section-id="storage"
              className="settings-group"
            >
              <div className="settings-group__head">
                <div>
                  <h2 className="settings-group__title">
                    {sectionMeta.storage.label}
                  </h2>
                  <p className="settings-group__sub">
                    {sectionMeta.storage.subtitle}
                  </p>
                </div>
              </div>

              <div className="settings-card settings-card--clip">
                <CleanRow
                  title="Install location"
                  description="Opens the folder where Lumen is installed."
                  buttonLabel={
                    <>
                      <FolderOpenIcon size={14} />
                      Open folder
                    </>
                  }
                  onAction={async () => {
                    const p = await window.electron?.getInstallPath?.();
                    if (p) window.electron.openPath(p);
                  }}
                />

                <CleanRow
                  title="Clear cache"
                  description="Removes temporary browser cache, shader cache, and service worker data across internal sessions. Personal data and settings stay intact."
                  buttonLabel="Clear cache"
                  onAction={handleClearCache}
                  sizeLabel={formatBytes(sizes.cache)}
                />

                <CleanRow
                  title="Clear watch progress"
                  description="Resets all watch history, continue-watching progress, and watched markings for movies and series."
                  buttonLabel="Clear progress"
                  onAction={() =>
                    new Promise((resolve) => {
                      progressConfirmResolveRef.current = resolve;
                      setShowProgressConfirm(true);
                    })
                  }
                  danger
                />

                <CleanRow
                  title="Delete all downloads"
                  description="Permanently deletes all video files downloaded through Lumen and clears the download list. Other files in your folder are untouched."
                  buttonLabel="Delete all"
                  onAction={() =>
                    new Promise((resolve) => {
                      deleteDlConfirmResolveRef.current = resolve;
                      setShowDeleteDlConfirm(true);
                    })
                  }
                  sizeLabel={formatBytes(sizes.downloads)}
                  danger
                />

                <div className="settings-row settings-row--top settings-row--danger">
                  <div className="settings-row__info">
                    <div className="settings-row__label">
                      <span>Reset app</span>
                      <span className="lumen-badge lumen-badge--danger">
                        Irreversible
                      </span>
                    </div>
                    <div className="settings-row__desc">
                      Resets Lumen to factory defaults: clears all settings,
                      tokens, library, watch history, and caches. Downloaded
                      video files are not touched.
                    </div>
                  </div>
                  <div className="settings-row__control">
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn--sm"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      Reset app
                    </button>
                  </div>
                </div>
              </div>
            </section>
        </div>
      </div>
    </>
  );
}
