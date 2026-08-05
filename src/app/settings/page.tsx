"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactElement,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { AuthApiError, apiFetch, logout } from "@/lib/passkey/client";

type InviteRecord = {
  token: string;
  label: string;
  status: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export default function SettingsPage(): ReactElement {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadInvites = useCallback(async (): Promise<void> => {
    const data = await apiFetch<InviteRecord[]>("/api/invites");
    setInvites(data);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInvites().catch((e: unknown) => {
        setError(true);
        setStatus(e instanceof Error ? e.message : "Failed to load invites");
      });
    }, 0);
    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [loadInvites]);

  async function handleCreate(
    event: SyntheticEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    const trimmed = label.trim();
    if (trimmed === "") {
      return;
    }
    setBusy(true);
    setError(false);
    setStatus("Creating invite…");
    try {
      const invite = await apiFetch<{ url: string }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ label: trimmed }),
      });
      await navigator.clipboard.writeText(invite.url);
      setLabel("");
      setStatus("Invite created and link copied.");
      await loadInvites();
    } catch (e) {
      setError(true);
      setStatus(
        e instanceof AuthApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to create invite"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 640 }}>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Settings</h1>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Invites</h2>
        <form
          onSubmit={(e) => {
            void handleCreate(e);
          }}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
        >
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
            placeholder="Label (name or device)"
            maxLength={120}
            style={{ flex: 1, padding: "0.5rem" }}
          />
          <button type="submit" disabled={busy || label.trim() === ""}>
            Create & copy link
          </button>
        </form>
        {status !== "" && (
          <p style={{ color: error ? "#b91c1c" : "#065f46" }}>{status}</p>
        )}
        {invites.length === 0 ? (
          <p>No invites yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {invites.map((invite) => (
              <li
                key={invite.token}
                style={{
                  borderBottom: "1px solid #e5e7eb",
                  padding: "0.75rem 0",
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <strong>{invite.label}</strong>
                <span>{invite.status}</span>
                {invite.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(invite.url);
                      setError(false);
                      setStatus("Invite link copied.");
                    }}
                  >
                    Copy link
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Session</h2>
        <button
          type="button"
          onClick={() => {
            void handleLogout();
          }}
          style={{ padding: "0.6rem 1.2rem", cursor: "pointer" }}
        >
          Log out
        </button>
      </section>
    </div>
  );
}
