import { useState } from "react";
import { KeyIcon, GlobeIcon, CheckIcon, ClockIcon, WarningIcon } from "./Icons";
import { secureStorage, STORAGE_KEYS } from "../utils/storage";
import { useModal } from "../utils/useModal";

export default function WyzieKeyModal({ onDone, onSkip }) {
  const [manualKey, setManualKey] = useState("");
  const [phase, setPhase] = useState("prompt");
  const [errorMsg, setErrorMsg] = useState("");

  const isElectron = typeof window !== "undefined" && !!window.electron;

  const busy = phase === "redeeming" || phase === "validating" || phase === "success";
  const { dialogProps, backdropProps, titleId } = useModal(busy ? null : onSkip);

  const saveAndFinish = async (key) => {
    await secureStorage.set(STORAGE_KEYS.WYZIE_API_KEY, key.trim());
    setPhase("success");
    setTimeout(() => onDone(key.trim()), 1000);
  };

  const handleManualSubmit = async () => {
    const key = manualKey.trim();
    if (!key) return;
    setPhase("validating");
    setErrorMsg("");
    try {
      const res = isElectron
        ? await window.electron.wyzieValidateKey(key)
        : { ok: true };
      if (res.ok) {
        await saveAndFinish(key);
      } else {
        setPhase("manual");
        setErrorMsg(res.error || "Invalid key, please try again.");
      }
    } catch (e) {
      setPhase("manual");
      setErrorMsg(e.message);
    }
  };

  const handleRedeem = async () => {
    if (!isElectron) return;
    setPhase("redeeming");
    setErrorMsg("");
    try {
      const res = await window.electron.wyzieOpenRedeem();
      if (res.cancelled) {
        setPhase("prompt");
        return;
      }
      if (res.timeout) {
        setPhase("timeout");
        return;
      }
      if (res.ok && res.key) {
        await saveAndFinish(res.key);
      } else {
        setPhase("prompt");
        setErrorMsg("Could not extract API key. Please copy it manually.");
      }
    } catch (e) {
      setPhase("prompt");
      setErrorMsg(e.message);
    }
  };

  return (
    <div
      className="lumen-dialog-backdrop"
      style={{ zIndex: 9999 }}
      {...backdropProps}
    >
      <div
        className="lumen-dialog lumen-dialog--sm"
        {...dialogProps}
        aria-labelledby={titleId}
      >
        <div className="lumen-dialog__body" style={{ padding: "24px 28px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              className="lumen-dialog__icon-badge lumen-dialog__icon-badge--accent"
              style={{ marginBottom: 0, width: 40, height: 40 }}
            >
              <KeyIcon size={18} />
            </div>
            <div>
              <div id={titleId} style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                Wyzie Subs requires an API key
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                Free, no account required
              </div>
            </div>
          </div>

          {(phase === "prompt" || phase === "error") && (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Wyzie Subs requires a free API key. Claim one instantly by
                solving a quick captcha — no registration needed.
                {errorMsg && (
                  <div
                    className="lumen-callout lumen-callout--danger"
                    role="alert"
                    style={{ marginTop: 12 }}
                  >
                    <WarningIcon size={15} />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn--sm"
                  style={{ width: "100%", height: 38 }}
                  onClick={handleRedeem}
                  disabled={!isElectron}
                >
                  Get free key — open redeem page
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  style={{ width: "100%", height: 38 }}
                  onClick={() => {
                    setPhase("manual");
                    setErrorMsg("");
                  }}
                >
                  I already have a key — enter manually
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn--sm"
                  style={{ width: "100%", color: "var(--text3)" }}
                  onClick={onSkip}
                >
                  Skip — use without subtitles
                </button>
              </div>
            </>
          )}

          {phase === "manual" && (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text2)",
                  marginBottom: 12,
                  lineHeight: 1.6,
                }}
              >
                Paste your Wyzie API key below. It looks like{" "}
                <code style={{ color: "var(--text)", fontSize: 11 }}>
                  wyzie-xxxxxxxxxxxxxxxx
                </code>
              </div>
              <input
                className="lumen-input lumen-input--mono"
                style={{ marginBottom: 12 }}
                type="text"
                aria-label="Wyzie API key"
                placeholder="wyzie-..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                autoFocus
              />
              {errorMsg && (
                <div
                  className="lumen-callout lumen-callout--danger"
                  role="alert"
                  style={{ marginBottom: 12 }}
                >
                  <WarningIcon size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn--sm"
                  onClick={() => {
                    setPhase("prompt");
                    setErrorMsg("");
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn--sm"
                  style={{ flex: 1 }}
                  onClick={handleManualSubmit}
                  disabled={!manualKey.trim()}
                >
                  Confirm & validate
                </button>
              </div>
            </>
          )}

          {phase === "redeeming" && (
            <div
              role="status"
              style={{
                textAlign: "center",
                padding: "20px 0",
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 12, color: "var(--text)" }}>
                <GlobeIcon size={26} />
              </div>
              <div
                style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}
              >
                Complete the captcha in the popup window
              </div>
              Please wait — key will be saved automatically…
            </div>
          )}

          {phase === "validating" && (
            <div
              role="status"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "24px 0",
                color: "var(--text3)",
                fontSize: 13,
              }}
            >
              <div
                className="spinner"
                style={{ width: 22, height: 22, borderWidth: 2 }}
              />
              <span>Validating key…</span>
            </div>
          )}

          {phase === "success" && (
            <div
              role="status"
              style={{
                textAlign: "center",
                padding: "24px 0",
                color: "var(--success)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <CheckIcon size={26} />
              </div>
              API key saved. Loading subtitles…
            </div>
          )}

          {phase === "timeout" && (
            <>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  color: "var(--text3)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ marginBottom: 10, color: "var(--text2)" }}>
                  <ClockIcon size={26} />
                </div>
                No key received within 10 seconds. The captcha may not have been
                completed, or the redirect failed.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn--sm"
                  style={{ width: "100%", height: 38 }}
                  onClick={handleRedeem}
                >
                  Try again
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn--sm"
                  style={{ width: "100%", height: 38 }}
                  onClick={() => {
                    setPhase("manual");
                    setErrorMsg("");
                  }}
                >
                  Enter key manually
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn--sm"
                  style={{ width: "100%", color: "var(--text3)" }}
                  onClick={onSkip}
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
