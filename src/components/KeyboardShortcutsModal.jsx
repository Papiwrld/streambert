import { CloseIcon, ExternalLinkIcon } from "./Icons";
import { useModal } from "../utils/useModal";

// Keyboard Shortcuts reference modal
export default function KeyboardShortcutsModal({ onClose }) {
  const { dialogProps, backdropProps, titleId } = useModal(onClose, { dismissKey: "?" });
  const shortcuts = [
    { keys: ["Ctrl", "F"], desc: "Open search" },
    { keys: ["Ctrl", "K"], desc: "Search (global, or filter on Downloads & Settings)" },
    { keys: ["Esc"], desc: "Close search / modal" },
    { keys: ["Ctrl", "Z"], desc: "Navigate back" },
    { keys: ["Ctrl", "R"], desc: "Reload app" },
    { keys: ["?"], desc: "Show this shortcuts overview" },
  ];

  const controllerShortcuts = [
    { keys: ["D-Pad"], desc: "Navigate menus" },
    { keys: ["A"], desc: "Select / confirm" },
    { keys: ["B"], desc: "Back / close" },
    { keys: ["Start"], desc: "Open search" },
    {
      keys: ["A / D-Pad / LB / RB"],
      desc: "In player: play-pause, seek, volume, skip ±15s",
    },
  ];

  return (
    <div className="lumen-dialog-backdrop" {...backdropProps}>
      <div
        className="lumen-dialog lumen-dialog--sm"
        style={{ maxWidth: 480 }}
        {...dialogProps}
        aria-labelledby={titleId}
      >
        <div className="lumen-dialog__header">
          <div id={titleId} className="lumen-dialog__title" style={{ fontSize: 18 }}>
            Keyboard shortcuts
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

        <div className="lumen-dialog__body">
          <div className="shortcuts-list">
            {shortcuts.map(({ keys, desc }, i) => (
              <div key={i} className="shortcuts-row">
                <span>{desc}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {keys.map((k, j) => (
                    <kbd key={j} className="shortcuts-kbd">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="lumen-dialog__section-label"
            style={{ marginTop: 22 }}
          >
            Controller
          </div>
          <div className="shortcuts-list">
            {controllerShortcuts.map(({ keys, desc }, i) => (
              <div key={i} className="shortcuts-row">
                <span>{desc}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {keys.map((k, j) => (
                    <kbd key={j} className="shortcuts-kbd">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="shortcuts-support">
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: 2,
                }}
              >
                Need help or found a bug?
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                Open an issue or browse the README on GitHub
              </div>
            </div>
            <a
              href="https://github.com/Papiwrld/streambert"
              onClick={(e) => {
                e.preventDefault();
                window.electron?.openExternal(
                  "https://github.com/Papiwrld/streambert",
                );
              }}
              className="btn btn-secondary btn--sm"
              style={{ textDecoration: "none" }}
            >
              <span>GitHub</span>
              <ExternalLinkIcon size={13} />
            </a>
          </div>

          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "var(--text3)",
              textAlign: "center",
            }}
          >
            Press <kbd className="shortcuts-kbd">?</kbd> or{" "}
            <kbd className="shortcuts-kbd">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}
