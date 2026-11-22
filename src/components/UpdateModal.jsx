import { useState, useEffect, useRef } from "react";
import { useModal } from "../utils/useModal";
import { CloseIcon, WarningIcon, CheckIcon, ExternalLinkIcon } from "./Icons";

// ── Image component that proxies through Electron main process ────────────────
function ReleaseImage({ src, alt, style }) {
  const [resolvedSrc, setResolvedSrc] = useState(null);

  useEffect(() => {
    if (!src) return;
    if (window.electron?.fetchReleaseImage) {
      window.electron.fetchReleaseImage(src).then((dataUri) => {
        setResolvedSrc(dataUri || src);
      });
    } else {
      setResolvedSrc(src);
    }
  }, [src]);

  if (!resolvedSrc) return null;
  return (
    <img
      src={resolvedSrc}
      alt={alt}
      style={style}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

// ── Inline markdown + GitHub formatter ────────────────────────────────────────
function inlineFormat(text) {
  const parts = [];
  const re =
    /(~~[^~]+~~|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>"')]+|@[\w-]+)/g;
  let last = 0,
    m,
    k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    const raw = m[0];

    if (raw.startsWith("~~")) {
      parts.push(
        <s key={k++} style={{ color: "var(--text3)" }}>
          {raw.slice(2, -2)}
        </s>,
      );
    } else if (raw.startsWith("**")) {
      parts.push(
        <strong key={k++} style={{ color: "var(--text)", fontWeight: 600 }}>
          {raw.slice(2, -2)}
        </strong>,
      );
    } else if (raw.startsWith("*") || raw.startsWith("_")) {
      parts.push(
        <em key={k++} style={{ color: "var(--text2)", fontStyle: "italic" }}>
          {raw.slice(1, -1)}
        </em>,
      );
    } else if (raw.startsWith("`")) {
      parts.push(
        <code
          key={k++}
          style={{
            fontSize: 11,
            background: "var(--surface2)",
            border: "1px solid var(--hairline)",
            borderRadius: 4,
            padding: "1px 5px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--text)",
          }}
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("![")) {
      const mm = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (mm) {
        parts.push(
          <ReleaseImage
            key={k++}
            src={mm[2]}
            alt={mm[1]}
            style={{
              maxWidth: "100%",
              verticalAlign: "middle",
              borderRadius: 6,
              border: "1px solid var(--hairline)",
            }}
          />,
        );
      }
    } else if (raw.startsWith("[")) {
      const mm = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        parts.push(
          <a
            key={k++}
            href={mm[2]}
            onClick={(e) => {
              e.preventDefault();
              window.electron?.openExternal(mm[2]);
            }}
            style={{
              color: "var(--red)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {mm[1]}
          </a>,
        );
      }
    } else if (raw.startsWith("@")) {
      const username = raw.slice(1);
      parts.push(
        <a
          key={k++}
          href={`https://github.com/${username}`}
          onClick={(e) => {
            e.preventDefault();
            window.electron?.openExternal(`https://github.com/${username}`);
          }}
          style={{
            color: "var(--red)",
            textDecoration: "none",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {raw}
        </a>,
      );
    } else if (raw.startsWith("http")) {
      let label = raw;
      try {
        const u = new URL(raw);
        const prMatch = u.pathname.match(/\/(pull|issues?)\/(\d+)$/);
        if (prMatch) label = `#${prMatch[2]}`;
        else label = u.hostname.replace(/^www\./, "") + u.pathname;
      } catch {}
      parts.push(
        <a
          key={k++}
          href={raw}
          onClick={(e) => {
            e.preventDefault();
            window.electron?.openExternal(raw);
          }}
          style={{
            color: "var(--red)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "0.95em",
          }}
        >
          {label}
        </a>,
      );
    }

    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

// ── Block-level markdown renderer ─────────────────────────────────────────────
function renderChangelog(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            marginTop: 14,
            marginBottom: 4,
          }}
        >
          {inlineFormat(line.slice(4))}
        </div>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            marginTop: 16,
            marginBottom: 6,
            borderBottom: "1px solid var(--hairline)",
            paddingBottom: 4,
          }}
        >
          {inlineFormat(line.slice(3))}
        </div>,
      );
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <div
          key={key++}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          {inlineFormat(line.slice(2))}
        </div>,
      );
      continue;
    }

    if (/^([-*_])\1{2,}\s*$/.test(line.trim())) {
      elements.push(
        <div
          key={key++}
          style={{
            borderBottom: "1px solid var(--hairline)",
            margin: "12px 0",
          }}
        />,
      );
      continue;
    }

    if (line.startsWith("> ")) {
      elements.push(
        <div
          key={key++}
          style={{
            borderLeft: "2px solid var(--red)",
            paddingLeft: 10,
            margin: "4px 0",
            color: "var(--text3)",
            fontSize: 13,
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {inlineFormat(line.slice(2))}
        </div>,
      );
      continue;
    }

    const htmlImgMatch = line.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/i);
    if (htmlImgMatch) {
      const src = htmlImgMatch[1];
      const altMatch = line.match(/\balt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : "";
      elements.push(
        <div key={key++} style={{ margin: "10px 0" }}>
          <ReleaseImage
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid var(--hairline)",
              display: "block",
            }}
          />
          {alt && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text3)",
                textAlign: "center",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {alt}
            </div>
          )}
        </div>,
      );
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      elements.push(
        <div key={key++} style={{ margin: "10px 0" }}>
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid var(--hairline)",
              display: "block",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {alt && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text3)",
                textAlign: "center",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {alt}
            </div>
          )}
        </div>,
      );
      continue;
    }

    const numMatch = line.match(/^(\d+)\. (.*)$/);
    if (numMatch) {
      elements.push(
        <div
          key={key++}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              color: "var(--red)",
              flexShrink: 0,
              fontWeight: 600,
              minWidth: 18,
              textAlign: "right",
            }}
          >
            {numMatch[1]}.
          </span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>,
      );
      continue;
    }

    if (/^[-*] /.test(line)) {
      elements.push(
        <div
          key={key++}
          style={{
            display: "flex",
            gap: 8,
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.6,
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--red)", flexShrink: 0, marginTop: 1 }}>
            •
          </span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>,
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: 6 }} />);
      continue;
    }

    elements.push(
      <div
        key={key++}
        style={{
          fontSize: 13,
          color: "var(--text2)",
          lineHeight: 1.6,
          marginBottom: 2,
        }}
      >
        {inlineFormat(line)}
      </div>,
    );
  }
  return elements;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UpdateModal({
  updateInfo,
  activeDownloads = 0,
  onClose,
}) {
  const { latest, current, url, changelog, assets, sourceLabel } = updateInfo;

  const [phase, setPhase] = useState("idle");
  const [format, setFormat] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const cancelRef = useRef(false);

  const busy = phase === "downloading" || phase === "installing";

  const { dialogProps, backdropProps, titleId } = useModal(busy ? null : onClose);

  useEffect(() => {
    if (!window.electron?.detectUpdateFormat) return;
    let mounted = true;
    window.electron.detectUpdateFormat().then((fmt) => {
      if (mounted) setFormat(fmt);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!window.electron?.onUpdateProgress) return;
    const handler = window.electron.onUpdateProgress((data) => {
      setProgress(data.percent ?? 0);
      setProgressLabel(data.label ?? "");
      if (data.label === "Installing…") {
        setPhase((current) => current === "downloading" ? "installing" : current);
      }
    });
    return () => window.electron.offUpdateProgress(handler);
  }, []);

  const assetUrl = format && assets?.[format];
  const canInstall =
    format && assetUrl && activeDownloads === 0 && phase === "idle";

  const handleInstall = async () => {
    if (!canInstall) return;
    cancelRef.current = false;
    setPhase("downloading");
    setProgress(0);
    setProgressLabel("Preparing…");

    try {
      const result = await window.electron.downloadAndInstallUpdate({
        url: assetUrl,
        format,
      });
      if (cancelRef.current) return;
      if (!result.ok) throw new Error(result.error || "Update failed");
      setPhase("done");
    } catch (e) {
      if (cancelRef.current) return;
      setPhase("error");
      setErrorMsg(e.message || "Update failed");
    }
  };

  const handleCancel = () => {
    if (phase === "installing") return;
    if (phase === "downloading") {
      cancelRef.current = true;
      window.electron?.cancelUpdate?.();
    }
    onClose();
  };

  const formatLabel =
    {
      appimage: "AppImage",
      deb: ".deb package",
      pacman: ".pacman (Arch)",
      exe: "Windows installer",
      dmg: "macOS installer (Universal)",
    }[format] || "installer";

  return (
    <div
      className="lumen-dialog-backdrop"
      {...backdropProps}
      style={{ cursor: busy ? "default" : "auto" }}
    >
      <div
        className="lumen-dialog lumen-dialog--md"
        {...dialogProps}
        aria-labelledby={titleId}
      >
        <div className="lumen-dialog__header">
          <div>
            <div id={titleId} className="lumen-dialog__title" style={{ fontSize: 18 }}>
              Update available
            </div>
            <div className="lumen-dialog__subtitle">
              {current && (
                <>
                  <span>v{current}</span>
                  <span style={{ fontSize: 11 }}>→</span>
                </>
              )}
              <a
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  window.electron?.openExternal(url);
                }}
                style={{
                  color: "var(--red)",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
                title={`View on ${sourceLabel || "GitHub"}`}
              >
                v{latest}
                <ExternalLinkIcon size={12} />
              </a>
              <span>is ready to install</span>
              {format && (
                <span className="lumen-badge lumen-badge--neutral">
                  {formatLabel}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={handleCancel}
            disabled={busy}
            aria-label="Close"
            data-modal-initial-focus
            style={{ opacity: busy ? 0.35 : 1 }}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="lumen-dialog__body">
          {changelog ? (
            <>
              <div className="lumen-dialog__section-label">What's new</div>
              <div>{renderChangelog(changelog)}</div>
            </>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--text3)",
                fontStyle: "italic",
              }}
            >
              No changelog available.
            </div>
          )}
        </div>

        <div
          className="lumen-dialog__footer"
          style={{ flexDirection: "column", alignItems: "stretch" }}
        >
          {activeDownloads > 0 && phase === "idle" && (
            <div className="lumen-callout lumen-callout--danger">
              <WarningIcon size={15} />
              <span>
                {activeDownloads} download{activeDownloads > 1 ? "s" : ""}{" "}
                running — finish or cancel them before updating.
              </span>
            </div>
          )}

          {!format && phase === "idle" && (
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              Could not detect install format. Use the{" "}
              <a
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  window.electron?.openExternal(url);
                }}
                style={{ color: "var(--red)" }}
              >
                {sourceLabel || "GitHub"} releases page
              </a>{" "}
              to download manually.
            </div>
          )}

          {(phase === "downloading" || phase === "installing") && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text3)",
                  marginBottom: 6,
                }}
              >
                <span>
                  {progressLabel ||
                    (phase === "downloading"
                      ? "Downloading update…"
                      : "Installing…")}
                </span>
                {phase === "downloading" && (
                  <span>{Math.round(progress)}%</span>
                )}
              </div>
              <div
                className="lumen-progress-track"
                role="progressbar"
                aria-label="Update progress"
                aria-valuenow={phase === "downloading" ? Math.round(progress) : undefined}
              >
                <div
                  className={`lumen-progress-fill${phase === "installing" ? " lumen-progress-fill--indeterminate" : ""}`}
                  style={
                    phase === "installing" ? undefined : { width: `${progress}%` }
                  }
                />
              </div>
            </div>
          )}

          {phase === "error" && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "var(--red)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <WarningIcon size={14} />
              <span>{errorMsg}</span>
              <a
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  window.electron?.openExternal(url);
                }}
                style={{ color: "var(--red)", textDecoration: "underline" }}
              >
                Download manually
              </a>
            </div>
          )}

          {phase === "done" && (
            <div
              role="status"
              style={{
                fontSize: 13,
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckIcon size={15} />
              <span>Update downloaded — installer is running</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {phase !== "installing" && (
              <button
                type="button"
                className="btn btn-ghost btn--sm"
                onClick={handleCancel}
              >
                {phase === "downloading" ? "Cancel download" : "Close"}
              </button>
            )}
            {phase === "idle" && (
              <>
                <a
                  href={url}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron?.openExternal(url);
                  }}
                  className="btn btn-secondary btn--sm"
                  style={{ textDecoration: "none" }}
                >
                  <span>{sourceLabel || "GitHub"}</span>
                  <ExternalLinkIcon size={13} />
                </a>
                <button
                  type="button"
                  className="btn btn-primary btn--sm"
                  disabled={!canInstall}
                  onClick={handleInstall}
                  style={{ opacity: canInstall ? 1 : 0.5 }}
                >
                  Install update
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
