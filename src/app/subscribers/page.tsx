"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

type Subscriber = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  token: string;
  status: "pending" | "verified" | "unsubscribed";
  source: "form" | "luma" | "substack" | "manual";
};

type SearchResponse = {
  success: boolean;
  data?: { subscribers: Subscriber[] };
  error?: string;
};

type UpdateResponse = {
  success: boolean;
  data?: { subscriber: Subscriber };
  error?: string;
};

type CreateResponse = {
  success: boolean;
  data?: { subscriber: Subscriber };
  error?: string;
};

type DeleteResponse = {
  success: boolean;
  data?: { deleted: boolean };
  error?: string;
};

const SOURCES: Subscriber["source"][] = ["form", "luma", "substack", "manual"];
const STATUSES: Subscriber["status"][] = [
  "pending",
  "verified",
  "unsubscribed",
];

export default function SubscribersPage(): ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Subscriber[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [editSource, setEditSource] = useState<Subscriber["source"] | "">("");
  const [editStatus, setEditStatus] = useState<Subscriber["status"] | "">("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newSource, setNewSource] = useState<Subscriber["source"]>("manual");
  const [newStatus, setNewStatus] = useState<Subscriber["status"]>("pending");
  const [createLoading, setCreateLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const runSearch = useCallback(async (q: string): Promise<void> => {
    setSearchLoading(true);
    setMessage(null);
    try {
      const url = `/api/subscribers?email=${encodeURIComponent(q)}`;
      const response = await fetch(url);
      const data = (await response.json()) as SearchResponse;
      if (data.success && data.data?.subscribers !== undefined) {
        setResults(data.data.subscribers);
        setSelected(null);
      } else {
        setResults([]);
        setMessage({
          type: "error",
          text: data.error ?? "Search failed",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setResults([]);
      setMessage({ type: "error", text: err.message });
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function handleSearchSubmit(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): void {
    e.preventDefault();
    void runSearch(query);
  }

  function handleSelectSubscriber(s: Subscriber): void {
    setSelected(s);
    setEditSource(s.source);
    setEditStatus(s.status);
    setMessage(null);
  }

  async function handleCreate(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): Promise<void> {
    e.preventDefault();
    if (newEmail.trim() === "") {
      setMessage({ type: "error", text: "Enter an email address." });
      return;
    }
    setCreateLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          source: newSource,
          status: newStatus,
        }),
      });
      const data = (await response.json()) as CreateResponse;
      if (data.success && data.data?.subscriber !== undefined) {
        setMessage({
          type: "success",
          text: `Added ${data.data.subscriber.email} (${data.data.subscriber.source}, ${data.data.subscriber.status}).`,
        });
        setNewEmail("");
        setSelected(data.data.subscriber);
        setEditSource(data.data.subscriber.source);
        setEditStatus(data.data.subscriber.status);
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to add subscriber",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleUpdate(): Promise<void> {
    if (selected === null) return;
    if (editSource === "" || editStatus === "") {
      setMessage({
        type: "error",
        text: "Choose both source and status",
      });
      return;
    }
    setUpdateLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/subscribers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          source: editSource,
          status: editStatus,
        }),
      });
      const data = (await response.json()) as UpdateResponse;
      if (data.success && data.data?.subscriber !== undefined) {
        setSelected(data.data.subscriber);
        setEditSource(data.data.subscriber.source);
        setEditStatus(data.data.subscriber.status);
        setMessage({ type: "success", text: "Subscriber updated." });
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Update failed",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setUpdateLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (selected === null) return;
    setDeleteLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/subscribers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = (await response.json()) as DeleteResponse;
      if (data.success) {
        const deletedEmail = selected.email;
        setSelected(null);
        setShowDeleteConfirm(false);
        setMessage({
          type: "success",
          text: `Subscriber ${deletedEmail} deleted.`,
        });
        void runSearch(query);
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Delete failed",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setDeleteLoading(false);
    }
  }

  const style = {
    page: {
      padding: "2rem",
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: "720px",
      margin: "0 auto",
      backgroundColor: "#f3f4f6",
      minHeight: "100vh",
    },
    backLink: {
      display: "inline-block",
      marginBottom: "16px",
      fontSize: "14px",
      color: "#2563eb",
      textDecoration: "none",
    },
    h1: { fontSize: "22px", marginBottom: "8px", color: "#111" },
    description: { marginBottom: "20px", fontSize: "14px", color: "#6b7280" },
    formRow: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-end",
      flexWrap: "wrap" as const,
      marginBottom: "20px",
    },
    input: {
      width: "280px",
      padding: "8px 12px",
      fontSize: "14px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      boxSizing: "border-box" as const,
      backgroundColor: "#fff",
    },
    label: {
      display: "block",
      marginBottom: "6px",
      fontWeight: "500",
      fontSize: "13px",
      color: "#374151",
    },
    button: (disabled: boolean): CSSProperties => ({
      backgroundColor: disabled ? "#9ca3af" : "#2563eb",
      color: "white",
      padding: "8px 16px",
      fontSize: "14px",
      border: "none",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    message: (type: "success" | "error"): CSSProperties => ({
      marginBottom: "20px",
      padding: "12px 16px",
      backgroundColor: type === "success" ? "#d1fae5" : "#fee2e2",
      color: type === "success" ? "#065f46" : "#991b1b",
      borderRadius: "6px",
      fontSize: "14px",
    }),
    card: {
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      border: "1px solid #e5e7eb",
      overflow: "hidden" as const,
      marginBottom: "16px",
    },
    cardHeader: {
      padding: "12px 16px",
      borderBottom: "1px solid #e5e7eb",
      backgroundColor: "#f9fafb",
      fontSize: "13px",
      color: "#6b7280",
    },
    listItem: (active: boolean): CSSProperties => ({
      padding: "12px 16px",
      borderBottom: "1px solid #e5e7eb",
      cursor: "pointer",
      backgroundColor: active ? "#eff6ff" : "transparent",
      fontSize: "14px",
      color: "#111",
    }),
    detailSection: {
      padding: "16px",
      fontSize: "13px",
      color: "#374151",
    },
    detailRow: { marginBottom: "8px" },
    detailKey: { color: "#6b7280", marginRight: "8px" },
    select: {
      marginLeft: "8px",
      padding: "4px 8px",
      fontSize: "13px",
      border: "1px solid #d1d5db",
      borderRadius: "4px",
      marginRight: "12px",
    },
    token: {
      fontFamily: "monospace",
      fontSize: "12px",
      wordBreak: "break-all" as const,
    },
    detailFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "16px",
      gap: "12px",
    },
    deleteButton: (disabled: boolean): CSSProperties => ({
      backgroundColor: "transparent",
      color: "#dc2626",
      padding: "8px 16px",
      fontSize: "14px",
      border: "1px solid #dc2626",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    modalOverlay: {
      position: "fixed" as const,
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: "#fff",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      padding: "24px",
      maxWidth: "360px",
      width: "90%",
    },
    modalTitle: {
      fontSize: "16px",
      fontWeight: "600",
      color: "#111",
      marginBottom: "8px",
    },
    modalText: {
      fontSize: "14px",
      color: "#6b7280",
      marginBottom: "20px",
    },
    modalActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px",
    },
    cancelButton: {
      backgroundColor: "#f3f4f6",
      color: "#374151",
      padding: "8px 16px",
      fontSize: "14px",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "500",
    },
  };

  return (
    <div style={style.page}>
      <Link href="/test-email" style={style.backLink}>
        ← Testing
      </Link>
      <h1 style={style.h1}>Subscribers</h1>
      <p style={style.description}>
        Search by email to find a subscriber. Click a row to view and edit their
        record.
      </p>

      <form onSubmit={handleSearchSubmit} style={style.formRow}>
        <div>
          <label htmlFor="email-search" style={style.label}>
            Email search
          </label>
          <input
            id="email-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="e.g. user@example.com"
            disabled={searchLoading}
            style={style.input}
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          style={{
            ...style.button(searchLoading),
            alignSelf: "flex-end",
          }}
        >
          {searchLoading ? "Searching…" : "Search"}
        </button>
      </form>

      <div style={{ ...style.card, marginBottom: "20px" }}>
        <div style={style.cardHeader}>Add subscriber</div>
        <div style={{ padding: "16px" }}>
          <form
            onSubmit={(e) => {
              void handleCreate(e);
            }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label htmlFor="new-email" style={style.label}>
                Email
              </label>
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                }}
                placeholder="email@example.com"
                disabled={createLoading}
                required
                style={style.input}
              />
            </div>
            <div>
              <label htmlFor="new-source" style={style.label}>
                Source
              </label>
              <select
                id="new-source"
                value={newSource}
                onChange={(e) => {
                  setNewSource(e.target.value as Subscriber["source"]);
                }}
                disabled={createLoading}
                style={{ ...style.select, marginLeft: 0 }}
              >
                {SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-status" style={style.label}>
                Status
              </label>
              <select
                id="new-status"
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value as Subscriber["status"]);
                }}
                disabled={createLoading}
                style={{ ...style.select, marginLeft: 0 }}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={createLoading}
              style={style.button(createLoading)}
            >
              {createLoading ? "Adding…" : "Add"}
            </button>
          </form>
        </div>
      </div>

      {message && <div style={style.message(message.type)}>{message.text}</div>}

      {selected !== null && (
        <div style={style.card}>
          <div style={style.cardHeader}>Subscriber details</div>
          <div style={style.detailSection}>
            <div style={style.detailRow}>
              <span style={style.detailKey}>id</span>
              <span style={style.token}>{selected.id}</span>
            </div>
            <div style={style.detailRow}>
              <span style={style.detailKey}>email</span>
              {selected.email}
            </div>
            <div style={style.detailRow}>
              <span style={style.detailKey}>token</span>
              <span style={style.token}>{selected.token}</span>
            </div>
            <div style={style.detailRow}>
              <span style={style.detailKey}>created_at</span>
              {new Date(selected.created_at).toISOString()}
            </div>
            <div style={style.detailRow}>
              <span style={style.detailKey}>updated_at</span>
              {new Date(selected.updated_at).toISOString()}
            </div>
            <div style={{ marginTop: "16px", marginBottom: "8px" }}>
              <span style={style.detailKey}>source</span>
              <select
                value={editSource}
                onChange={(e) => {
                  setEditSource(e.target.value as Subscriber["source"]);
                }}
                style={style.select}
              >
                {SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
              <span style={style.detailKey}>status</span>
              <select
                value={editStatus}
                onChange={(e) => {
                  setEditStatus(e.target.value as Subscriber["status"]);
                }}
                style={style.select}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div style={style.detailFooter}>
              <button
                type="button"
                disabled={updateLoading}
                onClick={() => {
                  void handleUpdate();
                }}
                style={style.button(updateLoading)}
              >
                {updateLoading ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setShowDeleteConfirm(true);
                }}
                style={style.deleteButton(deleteLoading)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selected !== null && (
        <div
          style={style.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div style={style.modalContent}>
            <h2 id="delete-modal-title" style={style.modalTitle}>
              Delete subscriber?
            </h2>
            <p style={style.modalText}>
              This will permanently remove {selected.email} from the list. This
              cannot be undone.
            </p>
            <div style={style.modalActions}>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setShowDeleteConfirm(false);
                }}
                style={style.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  void handleDelete();
                }}
                style={{
                  ...style.button(deleteLoading),
                  backgroundColor: "#dc2626",
                }}
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={style.card}>
          <div style={style.cardHeader}>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
          {results.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                handleSelectSubscriber(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelectSubscriber(s);
                }
              }}
              style={style.listItem(selected?.id === s.id)}
            >
              {s.email}
              <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
                {s.status} · {s.source}
              </span>
            </div>
          ))}
        </div>
      )}

      {query.trim() !== "" &&
        !searchLoading &&
        results.length === 0 &&
        message === null && (
          <p style={{ fontSize: "14px", color: "#6b7280" }}>
            No subscribers match &quot;{query}&quot;.
          </p>
        )}
    </div>
  );
}
