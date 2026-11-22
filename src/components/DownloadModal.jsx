import { useState, useEffect, useCallback } from "react";
import { useModal } from "../utils/useModal";
import {
  CloseIcon,
  DownloadIcon,
  SettingsIcon,
  SubtitlesIcon,
  AccessibilityIcon,
  BotIcon,
  PlayIcon,
  WarningIcon,
  InfoIcon,
  PlusIcon,
  CheckIcon,
} from "./Icons";
import {
  storage,
  STORAGE_KEYS,
  secureStorage,
  isElectron,
} from "../utils/storage";
import {
  SUBTITLE_LANGUAGES,
  LANG_LABEL,
  sourceBadgeStyle,
  sourceBadgeLabel,
} from "../utils/subtitles";

// ── Subtitle Browser (standalone component to avoid re-mount on parent re-render) ──
export function SubtitleBrowser({
  tmdbId,
  mediaType,
  season,
  episode,
  subdlApiKey,
  wyzieApiKey,
  selectedSubs,
  setSelectedSubs,
  onClose,
  defaultLang,
}) {
  const [langFilter, setLangFilter] = useState(defaultLang);
  const [browseResults, setBrowseResults] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const { dialogProps, backdropProps, titleId } = useModal(onClose);

  const doSearch = async (lang) => {
    setBrowsing(true);
    setBrowseError(null);
    try {
      const res = await window.electron.searchSubtitles({
        tmdbId,
        mediaType,
        season,
        episode,
        languages: lang || "",
        subdlApiKey,
        wyzieApiKey,
      });
      if (!res.ok) {
        const errMsg = res.error || "Search failed";
        const is403 =
          errMsg.includes("403") ||
          errMsg.toLowerCase().includes("cannot consume");
        setBrowseError(
          is403
            ? "API error 403 — your SubDL or Wyzie API key is missing or invalid. Add a valid key in Settings."
            : errMsg,
        );
        setBrowseResults([]);
      } else setBrowseResults(res.results);
    } catch (e) {
      setBrowseError(e.message);
      setBrowseResults([]);
    } finally {
      setBrowsing(false);
    }
  };

  useEffect(() => {
    doSearch(langFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lumen-dialog-backdrop" {...backdropProps}>
      <div
        className="lumen-dialog lumen-dialog--md"
        style={{ maxHeight: "80vh" }}
        {...dialogProps}
        aria-labelledby={titleId}
      >
        <div className="lumen-dialog__header">
          <div className="lumen-dialog__title">
            <SubtitlesIcon size={16} />
            <span id={titleId}>Browse subtitles</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div
          className="lumen-dialog__section"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Language</span>
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
        </div>

        <div className="lumen-dialog__body lumen-dialog__body--flush">
          {browsing && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 28,
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              <div
                className="spinner"
                style={{ width: 16, height: 16, borderWidth: 2 }}
              />
              <span>Searching…</span>
            </div>
          )}
          {browseError && (
            <div style={{ padding: "16px 24px" }}>
              <div className="lumen-callout lumen-callout--danger">
                <WarningIcon size={15} />
                <span>{browseError}</span>
              </div>
            </div>
          )}
          {!browsing && browseResults?.length === 0 && (
            <div
              style={{
                padding: 24,
                color: "var(--text3)",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              No subtitles found
            </div>
          )}
          {!browsing &&
            browseResults?.map((r) => {
              const isSelected = selectedSubs.some(
                (s) => s.file_id === r.file_id,
              );
              return (
                <button
                  type="button"
                  key={r.file_id}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedSubs((prev) =>
                      isSelected
                        ? prev.filter((s) => s.file_id !== r.file_id)
                        : [...prev, r],
                    );
                  }}
                  className={`lumen-sub-row${isSelected ? " lumen-sub-row--selected" : ""}`}
                >
                  <span
                    className={`lumen-checkbox${isSelected ? " lumen-checkbox--checked" : ""}`}
                    style={{ marginTop: 2 }}
                  >
                    {isSelected && <CheckIcon size={11} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="lumen-sub-lang">{r.language}</span>
                      <span style={sourceBadgeStyle(r)}>
                        {sourceBadgeLabel(r)}
                      </span>
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
                      {r.from_trusted && (
                        <span
                          style={{ fontSize: 11, color: "var(--success)" }}
                          title="Trusted"
                        >
                          <CheckIcon size={11} />
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "var(--text)",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.release ||
                        r.file_name ||
                        `${r.language.toUpperCase()} subtitle`}
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

        <div
          className="lumen-dialog__footer"
          style={{ justifyContent: "space-between" }}
        >
          <span role="status" style={{ fontSize: 12, color: "var(--text3)" }}>
            {selectedSubs.length === 0
              ? "Select subtitles to download"
              : `${selectedSubs.length} subtitle${selectedSubs.length > 1 ? "s" : ""} selected`}
          </span>
          <button
            type="button"
            className="btn btn-primary btn--sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DownloadModal({
  onClose,
  m3u8Url,
  subtitles = [],
  mediaName,
  downloaderFolder,
  setDownloaderFolder,
  onOpenSettings,
  onDownloadStarted,
  mediaId,
  mediaType,
  season,
  episode,
  posterPath,
  tmdbId,
}) {
  const [downloadPath, setDownloadPath] = useState(
    () => storage.get("downloadPath") || "",
  );
  const [draftDownloadPath, setDraftDownloadPath] = useState(downloadPath);
  const [settingPath, setSettingPath] = useState(false);
  const [downloader, setDownloader] = useState(null);
  const [checking, setChecking] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(null);
  const [externalStatus, setExternalStatus] = useState(null);
  const startingDownload = downloadStatus === "starting";
  const { dialogProps, backdropProps, titleId } = useModal(startingDownload ? null : onClose);

  const [subEnabled, setSubEnabled] = useState(
    () =>
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== 0 &&
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== "0",
  );
  const [subdlApiKey, setSubdlApiKey] = useState("");
  const [wyzieApiKey, setWyzieApiKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      secureStorage.get(STORAGE_KEYS.SUBDL_API_KEY),
      secureStorage.get(STORAGE_KEYS.WYZIE_API_KEY),
    ]).then(([subdl, wyzie]) => {
      if (!mounted) return;
      if (subdl) setSubdlApiKey(subdl);
      setWyzieApiKey(wyzie || "");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const defaultLang = storage.get(STORAGE_KEYS.SUBTITLE_LANG) || "en";

  const [subResults, setSubResults] = useState(null);
  const [subSearching, setSubSearching] = useState(false);
  const [subSearchError, setSubSearchError] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);

  const canSearchOS = isElectron && !!tmdbId;

  const ua = navigator.userAgent.toLowerCase();
  const binaryHint = ua.includes("win")
    ? "Windows_x64-portable"
    : ua.includes("mac")
      ? "macOS_arm64-portable (Apple Silicon) or macOS_x86_64-portable (Intel)"
      : "Linux_x64-portable";
  const releaseUrl =
    "https://github.com/truelockmc/vid-dl-cli-only/releases/latest";

  useEffect(() => {
    if (!downloaderFolder || !isElectron) return;
    let mounted = true;
    setChecking(true);
    window.electron.checkDownloader(downloaderFolder).then((result) => {
      if (!mounted) return;
      setDownloader(result);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [downloaderFolder]);

  const searchSubtitles = useCallback(
    async (lang) => {
      if (!canSearchOS) return;
      setSubSearching(true);
      setSubSearchError(null);
      setSubResults(null);
      setSelectedSubs([]);
      try {
        const res = await window.electron.searchSubtitles({
          tmdbId,
          mediaType,
          season,
          episode,
          languages: lang,
          subdlApiKey,
          wyzieApiKey: wyzieApiKey || "",
        });
        if (!res.ok) {
          const errMsg = res.error || "Search failed";
          const is403 =
            errMsg.includes("403") ||
            errMsg.toLowerCase().includes("cannot consume");
          setSubSearchError(
            is403
              ? "API error 403 — your SubDL or Wyzie API key is missing or invalid. Add a valid key in Settings."
              : errMsg,
          );
          setSubResults([]);
          return;
        }
        setSubResults(res.results);
        if (res.results.length > 0) setSelectedSubs([res.results[0]]);
      } catch (e) {
        setSubSearchError(e.message);
        setSubResults([]);
      } finally {
        setSubSearching(false);
      }
    },
    [canSearchOS, tmdbId, mediaType, season, episode, subdlApiKey, wyzieApiKey],
  );

  useEffect(() => {
    if (!m3u8Url || !subEnabled || !canSearchOS) return;
    if (wyzieApiKey === null) return;
    if (!wyzieApiKey && !subdlApiKey) return;
    searchSubtitles(defaultLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m3u8Url, subEnabled, wyzieApiKey]);

  const pickBinaryFolder = async () => {
    const folder = await window.electron.pickFolder();
    if (folder) setDownloaderFolder(folder);
  };
  const pickDownloadFolder = async () => {
    const folder = await window.electron.pickFolder();
    if (folder) saveDownloadFolder(folder);
  };

  const saveDownloadFolder = (path) => {
    setDownloadPath(path);
    setDraftDownloadPath(path);
    storage.set("downloadPath", path);
    setSettingPath(false);
  };

  const handleOpenExternal = async () => {
    if (!m3u8Url || !isElectron) return;
    setExternalStatus({ ok: true, text: "Opening…" });
    try {
      const subs = [...subtitles];
      if (subEnabled) {
        for (const sub of selectedSubs) {
          if (sub.direct_url) subs.push({ url: sub.direct_url });
        }
      }
      const res = await window.electron.openStreamExternal({
        url: m3u8Url,
        title: mediaName,
        subtitles: subs,
      });
      setExternalStatus(
        res?.ok
          ? {
              ok: true,
              text: `Opened in ${res.player === "vlc" ? "VLC" : "mpv"}`,
            }
          : { ok: false, text: res?.error || "Could not open external player" },
      );
    } catch (e) {
      setExternalStatus({ ok: false, text: e.message });
    }
  };

  const handleDownload = async () => {
    if (startingDownload || !downloader?.token || !downloadPath || !m3u8Url) return;
    setDownloadStatus("starting");

    const resolvedSubs = [...subtitles];
    if (subEnabled && selectedSubs.length > 0) {
      for (const sub of selectedSubs) {
        try {
          let url = sub.direct_url || null;
          let resolvedFileName = null;
          if (!url && sub.file_id) {
            const urlRes = await window.electron.getSubtitleUrl({
              fileId: sub.file_id,
            });
            if (urlRes.ok) {
              url = urlRes.url;
              resolvedFileName = urlRes.file_name || null;
            }
          }
          if (url) {
            resolvedSubs.push({
              url,
              lang: sub.language,
              name: resolvedFileName || sub.release || sub.file_name,
              file_id: sub.file_id || null,
            });
          }
        } catch {}
      }
    }

    const result = await window.electron.runDownload({
      token: downloader.token,
      m3u8Url,
      subtitles: resolvedSubs,
      name: mediaName,
      downloadPath,
      mediaId,
      mediaType,
      season,
      episode,
      posterPath: posterPath || null,
      tmdbId: tmdbId || mediaId || null,
    }).catch((error) => ({ ok: false, error: error.message }));

    if (result.ok) {
      onDownloadStarted?.({
        id: result.id,
        name: mediaName,
        m3u8Url,
        downloadPath,
        filePath: null,
        status: "downloading",
        progress: 0,
        speed: "",
        size: "",
        totalFragments: 0,
        lastMessage: "Starting…",
        startedAt: Date.now(),
        completedAt: null,
        mediaId,
        mediaType,
        season,
        episode,
        posterPath: posterPath || null,
        tmdbId: tmdbId || mediaId || null,
        subtitles: resolvedSubs,
        subtitlePaths: [],
      });
      setDownloadStatus("ok");
    } else {
      setDownloadStatus(result.error || "Failed to start");
    }
  };

  const showFolderSettings = !downloadPath || settingPath;
  const folderSettings = showFolderSettings && (
    <div className="lumen-dialog__body">
      {!settingPath && (
        <div
          className="lumen-callout lumen-callout--danger"
          style={{ marginBottom: 16 }}
        >
          <WarningIcon size={15} />
          <span>
            No download folder set. Choose where downloaded videos should
            be saved.
          </span>
        </div>
      )}
      {settingPath && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text2)",
            marginBottom: 14,
          }}
        >
          Choose where downloaded videos should be saved:
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <input
          className="lumen-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="/home/you/Movies"
          aria-label="Download folder"
          data-modal-initial-focus
          value={draftDownloadPath}
          onChange={(e) => setDraftDownloadPath(e.target.value)}
        />
        {isElectron && (
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            onClick={pickDownloadFolder}
          >
            Browse
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={!draftDownloadPath.trim()}
          onClick={() => saveDownloadFolder(draftDownloadPath.trim())}
        >
          Confirm
        </button>
        {settingPath && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSettingPath(false)}
          >
            Cancel
          </button>
        )}
      </div>

      {onOpenSettings && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            className="btn btn-ghost btn--sm"
            onClick={() => {
              onClose();
              onOpenSettings("downloads");
            }}
          >
            <SettingsIcon size={14} />
            Open settings
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="lumen-dialog-backdrop" {...backdropProps}>
        <div
          className="lumen-dialog lumen-dialog--md"
          {...dialogProps}
          aria-labelledby={titleId}
        >
          <div className="lumen-dialog__header">
            <div className="lumen-dialog__title">
              <DownloadIcon size={16} />
              <span id={titleId}>{showFolderSettings ? "Set download folder" : "Download"}</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close"
              disabled={startingDownload}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {showFolderSettings ? (
            folderSettings
          ) : !m3u8Url ? (
            <div className="download-waiting" role="status">
              <div
                className="spinner"
                style={{ width: 22, height: 22, borderWidth: 2 }}
              />
              <span>Waiting for stream URL… (start the video first)</span>
            </div>
          ) : (
            <div className="lumen-dialog__body lumen-dialog__body--flush">
              <div className="lumen-dialog__section">
                <div className="lumen-dialog__section-label">
                  Stream URL found
                </div>
                <code className="download-url-code">{m3u8Url}</code>
              </div>

              {isElectron && (
                <div
                  className="lumen-dialog__section"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn--sm"
                    onClick={handleOpenExternal}
                    title="Play this stream in mpv or VLC"
                  >
                    <PlayIcon size={13} />
                    Open in external player
                  </button>
                  {externalStatus && (
                    <span
                      style={{
                        fontSize: 12,
                        color: externalStatus.ok
                          ? "var(--success)"
                          : "var(--red)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {externalStatus.ok && <CheckIcon size={12} />}
                      {externalStatus.text}
                    </span>
                  )}
                </div>
              )}

              {/* Subtitle section */}
              <div className="lumen-dialog__section">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: subEnabled ? 10 : 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      color: "var(--text)",
                    }}
                  >
                    <SubtitlesIcon size={14} />
                    Subtitles
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={subEnabled}
                    aria-label={
                      subEnabled
                        ? "Disable subtitle download"
                        : "Enable subtitle download"
                    }
                    className={`lumen-switch${subEnabled ? " lumen-switch--on" : ""}`}
                    onClick={() => {
                      const next = !subEnabled;
                      setSubEnabled(next);
                      storage.set(STORAGE_KEYS.SUBTITLE_ENABLED, next ? 1 : 0);
                      if (
                        next &&
                        canSearchOS &&
                        (wyzieApiKey || subdlApiKey) &&
                        !subResults
                      ) {
                        searchSubtitles(defaultLang);
                      }
                    }}
                  >
                    <span className="lumen-switch__knob" />
                  </button>
                </div>

                {subEnabled && (
                  <>
                    {!canSearchOS && (
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>
                        No TMDB ID — subtitle search unavailable.
                      </div>
                    )}
                    {canSearchOS &&
                      !wyzieApiKey &&
                      !subdlApiKey &&
                      wyzieApiKey !== null && (
                        <div className="lumen-callout">
                          <WarningIcon size={15} />
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: 8 }}>
                              <strong style={{ color: "var(--text)" }}>
                                No subtitle API key set.
                              </strong>{" "}
                              Add a Wyzie or SubDL key in Settings to enable
                              subtitle search.
                            </div>
                            {onOpenSettings && (
                              <button
                                type="button"
                                className="btn btn-secondary btn--sm"
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
                      )}
                    {subSearching && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: "var(--text3)",
                        }}
                      >
                        <div
                          className="spinner"
                          style={{ width: 12, height: 12, borderWidth: 1.5 }}
                        />
                        <span>
                          Searching for {LANG_LABEL[defaultLang] || defaultLang}{" "}
                          subtitles…
                        </span>
                      </div>
                    )}
                    {subSearchError && !subSearching && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--red)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <WarningIcon size={13} />
                        <span>{subSearchError}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn--sm"
                          onClick={() => searchSubtitles(defaultLang)}
                        >
                          Retry
                        </button>
                        {onOpenSettings && (
                          <button
                            type="button"
                            className="btn btn-ghost btn--sm"
                            onClick={() => {
                              onClose();
                              onOpenSettings("subtitles");
                            }}
                          >
                            Open settings
                          </button>
                        )}
                      </div>
                    )}
                    {canSearchOS &&
                      !subSearching &&
                      subResults !== null &&
                      !subSearchError && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {selectedSubs.length > 0 ? (
                            selectedSubs.map((sub) => (
                              <div key={sub.file_id} className="lumen-sub-item">
                                <span className="lumen-sub-lang">
                                  {sub.language}
                                </span>
                                <span style={sourceBadgeStyle(sub)}>
                                  {sourceBadgeLabel(sub)}
                                </span>
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
                                >
                                  {sub.release ||
                                    sub.file_name ||
                                    `${sub.language.toUpperCase()} subtitle`}
                                </span>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() =>
                                    setSelectedSubs((prev) =>
                                      prev.filter(
                                        (s) => s.file_id !== sub.file_id,
                                      ),
                                    )
                                  }
                                  title="Remove"
                                  aria-label="Remove subtitle"
                                >
                                  <CloseIcon size={13} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text3)" }}>
                              No subtitles found for{" "}
                              {LANG_LABEL[defaultLang] || defaultLang}.
                            </span>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn--sm"
                              onClick={() => setShowBrowser(true)}
                            >
                              <PlusIcon size={13} />
                              {selectedSubs.length > 0
                                ? "Add / change"
                                : "Browse"}
                            </button>
                            {selectedSubs.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn--sm"
                                onClick={() => setSelectedSubs([])}
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    {canSearchOS &&
                      !subSearching &&
                      subResults === null &&
                      !subSearchError && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>
                            Not searched yet
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn--sm"
                            onClick={() => searchSubtitles(defaultLang)}
                          >
                            Search
                          </button>
                        </div>
                      )}
                    {!subdlApiKey && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: "var(--text3)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <InfoIcon size={12} />
                        <span>
                          Add a free SubDL API key in Settings for more results.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Downloader setup or ready */}
              {!downloader?.exists ? (
                <div className="download-instructions">
                  <div className="download-instructions-title">
                    Set up video downloader
                  </div>
                  <ol className="download-steps">
                    <li>
                      Download the latest release from{" "}
                      <a
                        className="download-link"
                        href={releaseUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          isElectron &&
                            window.electron.openExternal(releaseUrl);
                        }}
                      >
                        github.com/truelockmc/vid-dl-cli-only/releases/latest
                      </a>{" "}
                      for your OS: <code>{binaryHint}</code>
                    </li>
                    <li>Extract the release into a folder of your choice</li>
                    <li>
                      Select that folder below — it must contain{" "}
                      <code>_internal</code> and the binary
                    </li>
                  </ol>
                  <div className="download-folder-row">
                    <button
                      type="button"
                      className="btn btn-secondary btn--sm"
                      onClick={pickBinaryFolder}
                    >
                      Choose folder
                    </button>
                    {downloaderFolder && (
                      <span className="download-folder-path">
                        {downloaderFolder}
                      </span>
                    )}
                  </div>
                  {checking && (
                    <div className="download-checking">
                      <div
                        className="spinner"
                        style={{ width: 16, height: 16, borderWidth: 2 }}
                      />
                      <span>Checking…</span>
                    </div>
                  )}
                  {!checking &&
                    downloader &&
                    !downloader.exists &&
                    downloaderFolder && (
                      <div className="download-error">
                        {downloader.reason === "folder_permission" && (
                          <>Permission denied — cannot read the chosen folder.</>
                        )}
                        {downloader.reason === "folder_unreadable" && (
                          <>Folder could not be read. Is it still accessible?</>
                        )}
                        {downloader.reason === "no_internal" && (
                          <>
                            Missing <code>_internal</code> folder. Extract the
                            full release archive, not just the binary.
                          </>
                        )}
                        {(downloader.reason === "no_executable" ||
                          !downloader.reason) && (
                          <>
                            No executable binary found. On Linux, make sure the
                            binary has execute permissions (
                            <code>chmod +x</code>).
                          </>
                        )}
                      </div>
                    )}
                </div>
              ) : (
                <div className="download-ready">
                  <div className="download-found-badge">
                    <CheckIcon size={14} />
                    <span>Video downloader ready</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                      Wrong binary folder?
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn--sm"
                      onClick={pickBinaryFolder}
                    >
                      Change
                    </button>
                  </div>

                  {downloadStatus !== "ok" && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleDownload}
                      disabled={startingDownload}
                      style={{ width: "100%" }}
                    >
                      <DownloadIcon size={16} />
                      <span>
                        {downloadStatus === "starting"
                          ? "Starting…"
                          : "Start download"}
                      </span>
                    </button>
                  )}

                  {downloadStatus === "ok" && (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <div
                        className="download-success"
                        role="status"
                        style={{
                          fontSize: 15,
                          marginBottom: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <CheckIcon size={16} />
                        <span>Download started</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          className="btn btn-ghost btn--sm"
                          onClick={onClose}
                        >
                          Close — track progress in Downloads
                        </button>
                      </div>
                    </div>
                  )}

                  {downloadStatus &&
                    downloadStatus !== "ok" &&
                    downloadStatus !== "starting" && (
                      <div className="download-error" role="alert">{downloadStatus}</div>
                    )}

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      marginTop: 14,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                      Save to: <code>{downloadPath}</code>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn--sm"
                      disabled={startingDownload}
                      onClick={() => {
                        setDraftDownloadPath(downloadPath);
                        setSettingPath(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showBrowser && (
        <SubtitleBrowser
          tmdbId={tmdbId}
          mediaType={mediaType}
          season={season}
          episode={episode}
          subdlApiKey={subdlApiKey}
          wyzieApiKey={wyzieApiKey || ""}
          selectedSubs={selectedSubs}
          setSelectedSubs={setSelectedSubs}
          onClose={() => setShowBrowser(false)}
          defaultLang={defaultLang}
        />
      )}
    </>
  );
}
