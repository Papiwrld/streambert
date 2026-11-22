import { useId, useLayoutEffect, useRef } from "react";

const tabbableSelector = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

const modalStack = [];
const inertSiblings = new Set();
let observer;

export function getActiveModal() {
  return modalStack.at(-1)?.dialog ?? null;
}

export function dismissActiveModal() {
  const modal = modalStack.at(-1);
  if (!modal) return false;
  modal.dismiss.current?.();
  return true;
}

function canFocus(element) {
  return (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.matches(":disabled") &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible"
  );
}

function getTabStops(dialog) {
  return Array.from(dialog.querySelectorAll(tabbableSelector)).filter(
    (element) => element.tabIndex >= 0 && canFocus(element),
  );
}

function focusInside(dialog) {
  const preferred = dialog.querySelector("[data-modal-initial-focus]");
  const target = canFocus(preferred) ? preferred : getTabStops(dialog)[0] ?? dialog;
  target.focus({ preventScroll: true });
}

function updateIsolation(dialog) {
  const siblings = new Set();
  for (let element = dialog; element && element !== document.body; element = element.parentElement) {
    for (const sibling of element.parentElement?.children ?? []) {
      if (sibling !== element && sibling instanceof HTMLElement) siblings.add(sibling);
    }
  }

  for (const element of inertSiblings) {
    if (siblings.has(element)) continue;
    element.inert = false;
    inertSiblings.delete(element);
  }
  for (const element of siblings) {
    if (element.inert) continue;
    element.inert = true;
    inertSiblings.add(element);
  }
}

function keepFocusInside() {
  const dialog = getActiveModal();
  if (dialog?.isConnected && !dialog.contains(document.activeElement)) focusInside(dialog);
}

let syncFrame = 0;
function syncActiveModal() {
  updateIsolation(getActiveModal());
  keepFocusInside();
}

// Mutations come in bursts (progress ticks, toasts); resync at most once a frame.
function scheduleSync() {
  if (syncFrame) return;
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0;
    syncActiveModal();
  });
}

function handleKeyDown(event) {
  const modal = modalStack.at(-1);
  if (!modal || event.isComposing || event.defaultPrevented) return;

  const { dialog, dismissKey } = modal;
  if (
    event.key === "Escape" &&
    event.target instanceof Element &&
    dialog.contains(event.target.closest('[role="menu"]'))
  ) return;
  if (
    event.key === "Escape" ||
    (event.key === dismissKey && !event.ctrlKey && !event.metaKey && !event.altKey)
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) dismissActiveModal();
    return;
  }
  if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;

  const stops = getTabStops(dialog);
  const focused = document.activeElement;
  const first = stops[0];
  const last = stops.at(-1);
  if (
    !first ||
    !dialog.contains(focused) ||
    focused === dialog ||
    focused === (event.shiftKey ? first : last)
  ) {
    event.preventDefault();
    ((event.shiftKey ? last : first) ?? dialog).focus();
  }
}

export function useModal(onDismiss, { dismissKey } = {}) {
  const dialogRef = useRef(null);
  const dismiss = useRef(onDismiss);
  const id = useId();

  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const modal = { dialog, dismiss, dismissKey };
    modalStack.push(modal);

    if (modalStack.length === 1) {
      window.addEventListener("keydown", handleKeyDown, true);
      document.addEventListener("focusin", keepFocusInside);
      // New siblings can mount anywhere along the dialog's ancestor chain, so
      // watch the subtree, but batch the resync to once per frame.
      observer = new MutationObserver(scheduleSync);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    syncActiveModal();

    return () => {
      const wasActive = modal === modalStack.at(-1);
      modalStack.splice(modalStack.indexOf(modal), 1);
      const activeDialog = getActiveModal();
      updateIsolation(activeDialog);

      if (!activeDialog) {
        observer.disconnect();
        cancelAnimationFrame(syncFrame);
        syncFrame = 0;
        window.removeEventListener("keydown", handleKeyDown, true);
        document.removeEventListener("focusin", keepFocusInside);
      }
      if (wasActive) {
        if ((!activeDialog || activeDialog.contains(previousFocus)) && canFocus(previousFocus)) {
          previousFocus.focus({ preventScroll: true });
        }
        keepFocusInside();
      }
    };
  }, [dismissKey]);

  return {
    dialogProps: { ref: dialogRef, role: "dialog", "aria-modal": true, tabIndex: -1 },
    backdropProps: {
      onClick: (event) => {
        if (event.target === event.currentTarget && dialogRef.current === getActiveModal()) {
          dismiss.current?.();
        }
      },
    },
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
  };
}
