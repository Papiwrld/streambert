import { DownloadIcon } from "./Icons";
import { useModal } from "../utils/useModal";

export default function CloseConfirmModal({ count, onConfirm, onCancel }) {
  const { dialogProps, backdropProps, titleId, descriptionId } = useModal(onCancel);

  return (
    <div className="close-confirm-overlay" {...backdropProps}>
      <div
        className="close-confirm-modal"
        {...dialogProps}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="close-confirm-icon-wrap">
          <div className="close-confirm-icon-ring">
            <DownloadIcon />
          </div>
        </div>

        <div id={titleId} className="close-confirm-title">
          Download{count > 1 ? "s" : ""} in progress
        </div>

        <div id={descriptionId} className="close-confirm-body">
          <span className="close-confirm-count">
            {count} active download{count > 1 ? "s" : ""}
          </span>{" "}
          will be cancelled and incomplete files will be deleted.
        </div>

        <div className="close-confirm-actions">
          <button
            type="button"
            className="btn close-confirm-btn-cancel"
            data-modal-initial-focus
            onClick={onCancel}
          >
            Keep downloading
          </button>
          <button
            type="button"
            className="btn close-confirm-btn-confirm"
            onClick={onConfirm}
          >
            Cancel & close app
          </button>
        </div>
      </div>
    </div>
  );
}
