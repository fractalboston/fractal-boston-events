"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useState } from "react";
import {
  AuthApiError,
  fetchAuthStatus,
  runLoginCeremony,
  runSetupCeremony,
} from "@/lib/passkey/client";

export default function LoginPage(): ReactElement {
  const router = useRouter();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const auth = await fetchAuthStatus();
          if (auth.user !== undefined) {
            router.replace("/");
            return;
          }
          setSetupRequired(auth.setupRequired);
        } catch (e) {
          setError(true);
          setStatus(
            e instanceof Error ? e.message : "Failed to load auth status"
          );
          setSetupRequired(false);
        }
      })();
    }, 0);
    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [router]);

  async function handleSetup(): Promise<void> {
    setBusy(true);
    setError(false);
    setStatus("Waiting for passkey…");
    try {
      await runSetupCeremony();
      setStatus("Admin passkey created.");
      router.replace("/");
    } catch (e) {
      setError(true);
      setStatus(
        e instanceof AuthApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Setup failed"
      );
      setBusy(false);
    }
  }

  async function handleLogin(): Promise<void> {
    setBusy(true);
    setError(false);
    setStatus("Waiting for passkey…");
    try {
      await runLoginCeremony();
      router.replace("/");
    } catch (e) {
      setError(true);
      setStatus(
        e instanceof AuthApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Login failed"
      );
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 480 }}>
      <h1>Fractal Events</h1>
      {setupRequired === null && <p>Loading…</p>}
      {setupRequired === true && (
        <>
          <h2>Admin setup</h2>
          <p>Create the first passkey to unlock broadcasts and subscribers.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleSetup();
            }}
            style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}
          >
            Create passkey
          </button>
        </>
      )}
      {setupRequired === false && (
        <>
          <h2>Sign in</h2>
          <p>Use your passkey to continue.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleLogin();
            }}
            style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}
          >
            Sign in with passkey
          </button>
        </>
      )}
      {status !== "" && (
        <p style={{ color: error ? "#b91c1c" : "#065f46", marginTop: "1rem" }}>
          {status}
        </p>
      )}
    </div>
  );
}
