"use client";

import { useParams, useRouter } from "next/navigation";
import { type ReactElement, useEffect, useState } from "react";
import {
  AuthApiError,
  apiFetch,
  runInviteRegisterCeremony,
} from "@/lib/passkey/client";

type InviteDetails = {
  label: string;
  status: string;
  valid: boolean;
  expiresAt: string;
};

export default function InvitePage(): ReactElement {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const data = await apiFetch<InviteDetails>(`/api/invites/${token}`);
          setInvite(data);
          if (!data.valid) {
            setError(true);
            setStatus(
              data.status === "accepted"
                ? "This invite has already been used."
                : "This invite has expired."
            );
          }
        } catch (e) {
          setError(true);
          setStatus(
            e instanceof AuthApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Invite not found"
          );
        }
      })();
    }, 0);
    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [token]);

  async function handleRegister(): Promise<void> {
    setBusy(true);
    setError(false);
    setStatus("Waiting for passkey…");
    try {
      await runInviteRegisterCeremony(token);
      router.replace("/");
    } catch (e) {
      setError(true);
      setStatus(
        e instanceof AuthApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Registration failed"
      );
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 480 }}>
      <h1>Accept invite</h1>
      {invite === null && !error && <p>Loading invite…</p>}
      {invite !== null && (
        <>
          <p>
            Invite for <strong>{invite.label}</strong>
          </p>
          {invite.valid ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void handleRegister();
              }}
              style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}
            >
              Create passkey
            </button>
          ) : null}
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
