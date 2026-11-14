import React, { useState } from "react";

export interface GuestAccessGateProps {
  readonly onStarted?: () => void;
  readonly endpoint?: string;
}

export function GuestAccessGate({
  onStarted,
  endpoint = "/api/guest/lease",
}: GuestAccessGateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueAsGuest = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "guest" }),
      });
      if (!response.ok) throw new Error("Guest access is unavailable.");
      onStarted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Guest access is unavailable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-skipo-guest-gate="true">
      <button type="button" onClick={continueAsGuest} disabled={busy}>
        {busy ? "Starting guest workspace…" : "Continue as Guest"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
