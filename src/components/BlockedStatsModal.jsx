import { CloseIcon, ShieldBlockIcon } from "./Icons";
import { useModal } from "../utils/useModal";

/**
 * Modal showing which ad/tracker domains were blocked during the current session
 * and the all-time total blocked count.
 */
export default function BlockedStatsModal({
  sessionDomains,
  sessionTotal,
  alltimeTotal,
  onClose,
}) {
  const { dialogProps, backdropProps, titleId } = useModal(onClose);

  return (
    <div className="blocked-modal-overlay" {...backdropProps}>
      <div className="blocked-modal" {...dialogProps} aria-labelledby={titleId}>
        <div className="blocked-modal-header">
          <div id={titleId} className="blocked-modal-title">
            <ShieldBlockIcon size={15} />
            Ads &amp; trackers blocked
          </div>
          <button
            type="button"
            className="blocked-modal-close"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="blocked-modal-subtitle">
          {sessionTotal > 0
            ? `${sessionTotal} ad/tracker request${sessionTotal === 1 ? "" : "s"} blocked this session`
            : "Start playing content to see blocked ads & trackers."}
        </div>

        <div className="blocked-modal-list">
          {sessionDomains.length === 0 ? (
            <div className="blocked-modal-empty">
              No ads or trackers blocked yet, play something to start.
            </div>
          ) : (
            sessionDomains.map(([domain, count]) => (
              <div key={domain} className="blocked-modal-row">
                <span className="blocked-modal-domain">{domain}</span>
                <span className="blocked-modal-count">
                  {count.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="blocked-modal-footer">
          <ShieldBlockIcon size={13} />
          All-time:&nbsp;
          <strong>
            {alltimeTotal.toLocaleString()} ad &amp; tracker request
            {alltimeTotal === 1 ? "" : "s"}
          </strong>
          &nbsp;blocked
        </div>
      </div>
    </div>
  );
}
