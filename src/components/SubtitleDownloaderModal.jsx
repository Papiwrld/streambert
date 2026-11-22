import { useState, useEffect, useRef, useCallback } from "react";
import { useModal } from "../utils/useModal";
import {
  TrashIcon,
  SubtitlesIcon,
  SettingsIcon,
  AccessibilityIcon,
  BotIcon,
  CloseIcon,
  RefreshIcon,
  WarningIcon,
  DownloadIcon,
  CheckIcon,
} from "./Icons";
import { storage, STORAGE_KEYS, secureStorage } from "../utils/storage";
import { SUBTITLE_LANGUAGES } from "../utils/subtitles";

// ── Subtitle Downloader Modal (for retroactive subtitle download) ───────────────
export default function SubtitleDownloaderModal({
  dl,
  onClose,
  onSubtitlesSaved,
  onSubtitleDeleted,
  onOpenSettings,
}) {
  const defaultLang = storage.get(STORAGE_KEYS.SUBTITLE_LANG) || "en";
  const [subdlApiKey, setSubdlApiKey] = useState(null);
  const [wyzieApiKey, setWyzieApiKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      secureStorage.get(STORAGE_KEYS.SUBDL_API_KEY),
      secureStorage.get(STORAGE_KEYS.WYZIE_API_KEY),
    ]).then(([subdl, wyzie]) => {
      if (!mounted) return;
      setSubdlApiKey(subdl || "");
      setWyzieApiKey(wyzie || "");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const [langFilter, setLangFilter] = useState(defaultLang);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState(null);
  const [done, setDone] = useState(false);
  const doneTimerRef = useRef(null);
  useEffect(
    () => () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    },
    [],
  );
  const [deletingPath, setDeletingPath] = useState(null);
  const busy = downloading || !!deletingPath;
  const { dialogProps, backdropProps, titleId } = useModal(busy ? null : onClose);

  const existingSubs = dl.subtitlePaths || [];
  const existingFileIds = new Set(
    existingSubs.map((s) => s.file_id).filter(Boolean),
  );
  const existingLangs = new Set(existingSubs.map((s) => s.lang));

  const doSearch = useCallback(
    async (lang) => {
      if (!dl.tmdbId) return;
      setSearching(true);
      setSearchError(null);
      setResults(null);
      try {
        const res = await window.electron.searchSubtitles({
          tmdbId: dl.tmdbId,
          mediaType: dl.mediaType,
          season: dl.season,
          episode: dl.episode,
          languages: lang || "",
          subdlApiKey,
          wyzieApiKey,
        });
        if (!res.ok) {
          setSearchError(res.error || "Search failed");
          setResults([]);
        } else setResults(res.results || []);
      } catch (e) {
        setSearchError(e.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [dl, subdlApiKey, wyzieApiKey],
  );

  useEffect(() => {
    if (subdlApiKey === null || wyzieApiKey === null) return;
    if (!subdlApiKey && !wyzieApiKey) return;
    doSearch(langFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdlApiKey, wyzieApiKey]);

  const handleDownload = async () => {
    if (busy || !selectedSubs.length || !dl.filePath) return;
    setDownloading(true);
    setDlError(null);
    try {
      const res = await window.electron.downloadSubtitlesForFile({
        filePath: dl.filePath,
        selectedSubs,
      });
      if (res.ok && res.subtitlePaths?.length > 0) {
        setDone(true);
        onSubtitlesSaved(res.subtitlePaths);
        doneTimerRef.current = setTimeout(() => {
          setDone(false);
          setSelectedSubs([]);
        }, 1500);
      } else {
        setDlError(res.error || "No subtitles could be saved.");
      }
    } catch (e) {
      setDlError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteSub = async (sp) => {
    if (
      busy || !confirm(
        `Delete subtitle "${(sp.lang || "?").toUpperCase()}"${sp.release ? ` (${sp.release})` : ""}?`,
      )
    )
      return;
    setDeletingPath(sp.path);
    try {
      await window.electron.deleteSubtitleFile({
        downloadId: dl.id,
        subtitlePath: sp.path,
      });
      onSubtitleDeleted(sp.path);
    } catch (e) {
      console.error("Delete subtitle error:", e);
    } finally {
      setDeletingPath(null);
    }
  };

  return (
    <div className="lumen-dialog-backdrop" {...backdropProps}>
      <div
        className="lumen-dialog lumen-dialog--lg"
        {...dialogProps}
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="lumen-dialog__header">
          <div className="lumen-dialog__title">
            <SubtitlesIcon size={16} />
            <span id={titleId}>Subtitles: {dl.name}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Existing / downloaded subtitles */}
        {existingSubs.length > 0 && (
          <div className="lumen-dialog__section">
            <div className="lumen-dialog__section-label">
              Downloaded subtitles
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {existingSubs.map((sp) => (
                <div key={sp.path} className="lumen-sub-item">
                  <span className="lumen-sub-lang">
                    {(sp.lang || "?").toUpperCase()}
                  </span>
                  {sp.source && (
                    <span
                      className={`lumen-badge ${sp.source === "subdl" ? "lumen-badge--info" : "lumen-badge--neutral"}`}
                      style={{ fontSize: 10, padding: "1px 6px" }}
                    >
                      {sp.source === "subdl" ? "SubDL" : "Wyzie"}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text2)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                    title={sp.release || sp.path}
                  >
                    {sp.release || sp.path.split(/[\\/]/).pop()}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      flexShrink: 0,
                    }}
                    title={sp.path}
                  >
                    .{sp.path.split(".").pop()}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={busy}
                    onClick={() => handleDeleteSub(sp)}
                    title="Delete this subtitle file"
                    aria-label={`Delete ${sp.lang || "unknown language"} subtitle`}
                    style={{
                      opacity: deletingPath === sp.path ? 0.4 : 1,
                    }}
                  >
                    {deletingPath === sp.path ? "…" : <TrashIcon size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Language filter + search controls */}
        <div
          className="lumen-dialog__section"
          style={{ display: "flex", gap: 10, alignItems: "center" }}
        >
          <span style={{ fontSize: 12, color: "var(--text3)" }}>
            Download more
          </span>
          <select
            aria-label="Subtitle language"
            value={langFilter}
            onChange={(e) => {
              setLangFilter(e.target.value);
              doSearch(e.target.value);
            }}
            className="lumen-input"
            style={{ width: "auto", height: 32, padding: "0 10px", fontSize: 12 }}
          >
            <option value="">All languages</option>
            {SUBTITLE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn--sm"
            onClick={() => doSearch(langFilter)}
            disabled={searching}
          >
            <RefreshIcon size={13} />
            <span>{searching ? "Searching…" : "Refresh"}</span>
          </button>
          {selectedSubs.length > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "var(--text3)",
                marginLeft: "auto",
              }}
            >
              {selectedSubs.length} selected
            </span>
          )}
        </div>

        {/* Results list */}
        <div className="lumen-dialog__body lumen-dialog__body--flush">
          {!wyzieApiKey && !subdlApiKey && wyzieApiKey !== null && (
            <div style={{ padding: "16px 24px" }}>
              <div className="lumen-callout">
                <WarningIcon size={15} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "var(--text)" }}>
                      No subtitle API key set.
                    </strong>{" "}
                    Add or generate a Wyzie or SubDL key in Settings to search
                    and download subtitles.
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      className="btn btn-secondary btn--sm"
                      disabled={busy}
                      onClick={() => {
                        onClose();
                        onOpenSettings("subtitles");
                      }}
                    >
                      <SettingsIcon size={13} />
                      Open subtitle settings
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {searching && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 28,
                color: "var(--text3)",
                fontSize: 13,
                justifyContent: "center",
              }}
            >
              <div
                className="spinner"
                style={{ width: 16, height: 16, borderWidth: 2 }}
              />
              <span>Searching…</span>
            </div>
          )}

          {searchError && !searching && (
            <div style={{ padding: "16px 24px" }}>
              <div className="lumen-callout lumen-callout--danger">
                <WarningIcon size={15} />
                <span>{searchError}</span>
              </div>
            </div>
          )}

          {!searching && results?.length === 0 && (
            <div
              style={{
                padding: 24,
                color: "var(--text3)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No subtitles found for this language
            </div>
          )}

          {!searching &&
            results?.map((r) => {
              const isSelected = selectedSubs.some(
                (s) => s.file_id === r.file_id,
              );
              const rLang = (r.language || "")
                .replace(/[^a-z0-9_-]/gi, "")
                .toLowerCase();
              const alreadyHave = r.file_id
                ? existingFileIds.has(r.file_id)
                : existingLangs.has(rLang);
              return (
                <button
                  type="button"
                  key={r.file_id}
                  aria-pressed={alreadyHave || isSelected}
                  disabled={alreadyHave || busy}
                  onClick={() => {
                    setSelectedSubs((prev) =>
                      isSelected
                        ? prev.filter((s) => s.file_id !== r.file_id)
                        : [...prev, r],
                    );
                  }}
                  className={`lumen-sub-row${alreadyHave ? " lumen-sub-row--owned" : isSelected ? " lumen-sub-row--selected" : ""}`}
                >
                  <span
                    className={`lumen-checkbox${alreadyHave ? " lumen-checkbox--disabled" : isSelected ? " lumen-checkbox--checked" : ""}`}
                    style={{ marginTop: 2 }}
                  >
                    {(alreadyHave || isSelected) && <CheckIcon size={10} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="lumen-sub-lang">{r.language}</span>
                      <span
                        className={`lumen-badge ${r.via_subdl ? "lumen-badge--info" : "lumen-badge--neutral"}`}
                        style={{ fontSize: 10, padding: "1px 6px" }}
                      >
                        {r.via_subdl ? "SubDL" : "Wyzie"}
                      </span>
                      {alreadyHave && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text3)",
                            fontStyle: "italic",
                          }}
                        >
                          already downloaded
                        </span>
                      )}
                      {r.hearing_impaired && (
                        <span
                          style={{ fontSize: 10, color: "var(--text3)" }}
                          title="Hearing impaired"
                        >
                          <AccessibilityIcon size={11} />
                        </span>
                      )}
                      {r.ai_translated && (
                        <span
                          style={{ fontSize: 10, color: "var(--text3)" }}
                          title="AI translated"
                        >
                          <BotIcon size={11} />
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.release ||
                        r.file_name ||
                        `${r.language?.toUpperCase()} subtitle`}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text3)" }}>
                      {r.uploader} · {(r.download_count || 0).toLocaleString()}{" "}
                      downloads
                    </span>
                  </span>
                </button>
              );
            })}
        </div>

        {/* Footer */}
        <div className="lumen-dialog__footer">
          {done ? (
            <span
              role="status"
              style={{
                fontSize: 13,
                color: "var(--success)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckIcon size={15} />
              Subtitles downloaded
            </span>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary btn--sm"
                disabled={
                  busy || selectedSubs.length === 0 || !dl.filePath
                }
                onClick={handleDownload}
                style={{
                  opacity: downloading || selectedSubs.length === 0 ? 0.5 : 1,
                }}
              >
                <DownloadIcon size={14} />
                <span>
                  {downloading
                    ? "Downloading…"
                    : selectedSubs.length > 0
                      ? `Download (${selectedSubs.length})`
                      : "Select subtitles above"}
                </span>
              </button>
              {!dl.filePath && (
                <span style={{ fontSize: 12, color: "var(--red)" }}>
                  Needs completed download
                </span>
              )}
              {dlError && (
                <span
                  role="alert"
                  style={{
                    fontSize: 12,
                    color: "var(--red)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <WarningIcon size={13} />
                  {dlError}
                </span>
              )}
            </>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn--sm"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
