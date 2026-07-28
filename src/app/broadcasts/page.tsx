"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { BRAND_COLOR, SENDER_EMAIL_DOMAIN } from "@/lib/constants";

type SenderIdentity = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  reply_to: string | null;
};

type BroadcastStatus = "draft" | "sending" | "sent" | "failed";

type Broadcast = {
  id: string;
  created_at: string;
  updated_at: string;
  subject: string;
  content: string;
  status: BroadcastStatus;
  sender_identity_id: string;
  test_sent_to: string | null;
  test_sent_at: string | null;
  sent_at: string | null;
  sent_from: string | null;
  sent_reply_to: string | null;
  recipient_count: number | null;
  success_count: number | null;
  failed_count: number | null;
};

type RecipientCounts = {
  totalCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
};

type BroadcastRecipient = {
  id: string;
  email: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error: string | null;
  sent_at: string | null;
};

type ListResponse = {
  success: boolean;
  data?: {
    broadcasts: Broadcast[];
    verifiedCount: number;
    emailEnabled: boolean;
  };
  error?: string;
};

type IdentitiesResponse = {
  success: boolean;
  data?: { identities: SenderIdentity[] };
  error?: string;
};

type IdentityResponse = {
  success: boolean;
  data?: { identity: SenderIdentity };
  error?: string;
};

type BroadcastResponse = {
  success: boolean;
  data?: { broadcast: Broadcast };
  error?: string;
};

type DetailResponse = {
  success: boolean;
  data?: {
    broadcast: Broadcast;
    counts: RecipientCounts;
    previewHtml: string;
    failedRecipients: BroadcastRecipient[];
    skippedRecipients: BroadcastRecipient[];
  };
  error?: string;
};

type SendResponse = {
  success: boolean;
  data?: {
    broadcast?: Broadcast;
    counts?: RecipientCounts;
    quotaAborted?: boolean;
    dryRun?: boolean;
    recipientCount?: number;
    message?: string;
  };
  error?: string;
};

type DeleteResponse = {
  success: boolean;
  data?: { deleted: boolean };
  error?: string;
};

const STATUS_COLORS: Record<BroadcastStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f3f4f6", fg: "#374151" },
  sending: { bg: "#fef3c7", fg: "#92400e" },
  sent: { bg: "#d1fae5", fg: "#065f46" },
  failed: { bg: "#fee2e2", fg: "#991b1b" },
};

export default function BroadcastsPage(): ReactElement {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NonNullable<
    DetailResponse["data"]
  > | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [confirmCount, setConfirmCount] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const [identityName, setIdentityName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityReplyTo, setIdentityReplyTo] = useState("");
  const [editingIdentityId, setEditingIdentityId] = useState<string | null>(
    null
  );
  const [identitySaveLoading, setIdentitySaveLoading] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadList = useCallback(async (): Promise<void> => {
    try {
      const [listResponse, identitiesResponse] = await Promise.all([
        fetch("/api/broadcasts"),
        fetch("/api/sender-identities"),
      ]);
      const listData = (await listResponse.json()) as ListResponse;
      const identitiesData =
        (await identitiesResponse.json()) as IdentitiesResponse;
      if (listData.success && listData.data !== undefined) {
        setBroadcasts(listData.data.broadcasts);
        setVerifiedCount(listData.data.verifiedCount);
        setEmailEnabled(listData.data.emailEnabled);
      } else {
        setMessage({
          type: "error",
          text: listData.error ?? "Failed to load broadcasts",
        });
      }
      if (identitiesData.success && identitiesData.data !== undefined) {
        setIdentities(identitiesData.data.identities);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadList();
    }, 0);

    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [loadList]);

  const loadDetail = useCallback(async (id: string): Promise<void> => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/broadcasts/${id}`);
      const data = (await response.json()) as DetailResponse;
      if (data.success && data.data !== undefined) {
        setDetail(data.data);
        setIsEditing(data.data.broadcast.status === "draft");
        setSubject(data.data.broadcast.subject);
        setContent(data.data.broadcast.content);
        setSenderIdentityId(data.data.broadcast.sender_identity_id);
      } else {
        setDetail(null);
        setMessage({
          type: "error",
          text: data.error ?? "Failed to load broadcast",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleSelect(broadcast: Broadcast): void {
    setSelectedId(broadcast.id);
    setDetail(null);
    setMessage(null);
    setDeleteArmed(false);
    setConfirmCount("");
    void loadDetail(broadcast.id);
  }

  function handleNew(): void {
    setSelectedId(null);
    setDetail(null);
    setIsEditing(true);
    setSubject("");
    setContent("");
    setSenderIdentityId(identities[0]?.id ?? "");
    setMessage(null);
    setDeleteArmed(false);
    setConfirmCount("");
  }

  async function handleSave(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): Promise<void> {
    e.preventDefault();
    if (senderIdentityId === "") {
      setMessage({ type: "error", text: "Choose a sender identity." });
      return;
    }
    setSaveLoading(true);
    setMessage(null);
    try {
      const isNew = selectedId === null;
      const response = await fetch(
        isNew ? "/api/broadcasts" : `/api/broadcasts/${selectedId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, content, senderIdentityId }),
        }
      );
      const data = (await response.json()) as BroadcastResponse;
      if (data.success && data.data?.broadcast !== undefined) {
        setSelectedId(data.data.broadcast.id);
        setMessage({ type: "success", text: "Draft saved." });
        await loadDetail(data.data.broadcast.id);
        void loadList();
      } else {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (selectedId === null) return;
    setDeleteLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/broadcasts/${selectedId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as DeleteResponse;
      if (data.success) {
        setSelectedId(null);
        setDetail(null);
        setIsEditing(false);
        setMessage({ type: "success", text: "Draft deleted." });
        void loadList();
      } else {
        setMessage({ type: "error", text: data.error ?? "Delete failed" });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setDeleteLoading(false);
      setDeleteArmed(false);
    }
  }

  async function handleTestSend(): Promise<void> {
    if (selectedId === null || testEmail.trim() === "") return;
    setTestLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/broadcasts/${selectedId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = (await response.json()) as BroadcastResponse;
      if (data.success) {
        setMessage({
          type: "success",
          text: `Test email sent to ${testEmail.trim()}.`,
        });
        await loadDetail(selectedId);
      } else {
        setMessage({ type: "error", text: data.error ?? "Test send failed" });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSend(): Promise<void> {
    if (selectedId === null || detail === null) return;
    setSendLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/broadcasts/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retryFailed: detail.broadcast.status === "failed",
        }),
      });
      const data = (await response.json()) as SendResponse;
      if (data.success && data.data !== undefined) {
        if (data.data.dryRun === true) {
          setMessage({
            type: "success",
            text: data.data.message ?? "Dry run complete.",
          });
        } else {
          const counts = data.data.counts;
          setMessage({
            type:
              counts !== undefined && counts.failedCount > 0
                ? "error"
                : "success",
            text:
              counts !== undefined
                ? `Broadcast finished: ${String(counts.sentCount)} sent, ${String(counts.failedCount)} failed, ${String(counts.skippedCount)} skipped.${data.data.quotaAborted === true ? " Send aborted early: SES quota exceeded. Retry later to resume." : ""}`
                : "Broadcast finished.",
          });
        }
        setConfirmCount("");
        await loadDetail(selectedId);
        void loadList();
      } else {
        setMessage({ type: "error", text: data.error ?? "Send failed" });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setSendLoading(false);
    }
  }

  async function handleDuplicate(): Promise<void> {
    if (selectedId === null) return;
    setDuplicateLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/broadcasts/${selectedId}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json()) as BroadcastResponse;
      if (data.success && data.data?.broadcast !== undefined) {
        setMessage({ type: "success", text: "Duplicated as a new draft." });
        setSelectedId(data.data.broadcast.id);
        await loadDetail(data.data.broadcast.id);
        void loadList();
      } else {
        setMessage({ type: "error", text: data.error ?? "Duplicate failed" });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setDuplicateLoading(false);
    }
  }

  function handleEditIdentity(identity: SenderIdentity): void {
    setEditingIdentityId(identity.id);
    setIdentityName(identity.name);
    setIdentityEmail(identity.email);
    setIdentityReplyTo(identity.reply_to ?? "");
  }

  function handleResetIdentityForm(): void {
    setEditingIdentityId(null);
    setIdentityName("");
    setIdentityEmail("");
    setIdentityReplyTo("");
  }

  async function handleSaveIdentity(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): Promise<void> {
    e.preventDefault();
    setIdentitySaveLoading(true);
    setMessage(null);
    try {
      const isNew = editingIdentityId === null;
      const replyTo = identityReplyTo.trim();
      const response = await fetch("/api/sender-identities", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? {
                name: identityName.trim(),
                email: identityEmail.trim(),
                ...(replyTo !== "" ? { replyTo } : {}),
              }
            : {
                id: editingIdentityId,
                name: identityName.trim(),
                replyTo: replyTo !== "" ? replyTo : null,
              }
        ),
      });
      const data = (await response.json()) as IdentityResponse;
      if (data.success && data.data?.identity !== undefined) {
        setMessage({
          type: "success",
          text: `Sender identity ${isNew ? "added" : "updated"}: ${data.data.identity.email}`,
        });
        handleResetIdentityForm();
        void loadList();
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to save sender identity",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setIdentitySaveLoading(false);
    }
  }

  const broadcast = detail?.broadcast ?? null;
  const isDraft = broadcast !== null && broadcast.status === "draft";
  const isSendable =
    broadcast !== null &&
    (broadcast.status === "draft" || broadcast.status === "failed") &&
    broadcast.test_sent_at !== null;
  const sendConfirmed = confirmCount.trim() === String(verifiedCount);

  const style = {
    page: {
      padding: "2rem",
      fontFamily: "system-ui, -apple-system, sans-serif",
      maxWidth: "900px",
      margin: "0 auto",
      backgroundColor: "#f3f4f6",
      minHeight: "100vh",
    },
    backLink: {
      display: "inline-block",
      marginBottom: "16px",
      fontSize: "14px",
      color: BRAND_COLOR,
      textDecoration: "none",
    },
    h1: { fontSize: "22px", marginBottom: "8px", color: "#111" },
    description: { marginBottom: "20px", fontSize: "14px", color: "#6b7280" },
    banner: {
      marginBottom: "20px",
      padding: "12px 16px",
      backgroundColor: "#fef3c7",
      color: "#92400e",
      borderRadius: "6px",
      fontSize: "14px",
    },
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
      marginBottom: "20px",
    },
    cardHeader: {
      padding: "12px 16px",
      borderBottom: "1px solid #e5e7eb",
      backgroundColor: "#f9fafb",
      fontSize: "13px",
      color: "#6b7280",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardBody: { padding: "16px" },
    label: {
      display: "block",
      marginBottom: "6px",
      fontWeight: "500",
      fontSize: "13px",
      color: "#374151",
    },
    input: {
      padding: "8px 12px",
      fontSize: "14px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      boxSizing: "border-box" as const,
      backgroundColor: "#fff",
    },
    textarea: {
      width: "100%",
      minHeight: "220px",
      padding: "8px 12px",
      fontSize: "13px",
      fontFamily: "monospace",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      boxSizing: "border-box" as const,
      backgroundColor: "#fff",
    },
    button: (disabled: boolean): CSSProperties => ({
      backgroundColor: disabled ? "#9ca3af" : BRAND_COLOR,
      color: "white",
      padding: "8px 16px",
      fontSize: "14px",
      border: "none",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    dangerButton: (disabled: boolean): CSSProperties => ({
      backgroundColor: "transparent",
      color: "#dc2626",
      padding: "8px 16px",
      fontSize: "14px",
      border: "1px solid #dc2626",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    secondaryButton: (disabled: boolean): CSSProperties => ({
      backgroundColor: "#f3f4f6",
      color: "#374151",
      padding: "8px 16px",
      fontSize: "14px",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    statusChip: (status: BroadcastStatus): CSSProperties => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "12px",
      fontWeight: "500",
      backgroundColor: STATUS_COLORS[status].bg,
      color: STATUS_COLORS[status].fg,
    }),
    listItem: (active: boolean): CSSProperties => ({
      padding: "12px 16px",
      borderBottom: "1px solid #e5e7eb",
      cursor: "pointer",
      backgroundColor: active ? "#eff6ff" : "transparent",
      fontSize: "14px",
      color: "#111",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    }),
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: "13px",
    },
    th: {
      textAlign: "left" as const,
      padding: "8px 12px",
      borderBottom: "1px solid #e5e7eb",
      color: "#6b7280",
      fontWeight: "500",
    },
    td: {
      padding: "8px 12px",
      borderBottom: "1px solid #f3f4f6",
      color: "#374151",
      verticalAlign: "top" as const,
    },
    hint: { fontSize: "13px", color: "#6b7280", marginTop: "8px" },
  };

  return (
    <div style={style.page}>
      <Link href="/" style={style.backLink}>
        ← Home
      </Link>
      <h1 style={style.h1}>Broadcasts</h1>
      <p style={style.description}>
        Compose and send one-off emails to all verified subscribers.
        Unsubscribed, bounced, and complained addresses are excluded
        automatically. A test send is required before sending to the list.
      </p>

      {!emailEnabled && !listLoading && (
        <div style={style.banner}>
          EMAIL_ENABLED is false — sends are dry runs. Test emails are still
          delivered, but sending to the list will only report what would happen.
        </div>
      )}

      {message && <div style={style.message(message.type)}>{message.text}</div>}

      <div style={style.card}>
        <div style={style.cardHeader}>
          <span>
            {listLoading
              ? "Loading…"
              : `${String(broadcasts.length)} broadcast${broadcasts.length === 1 ? "" : "s"} · ${String(verifiedCount)} verified subscribers`}
          </span>
          <button type="button" onClick={handleNew} style={style.button(false)}>
            New broadcast
          </button>
        </div>
        {broadcasts.map((b) => (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              handleSelect(b);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect(b);
              }
            }}
            style={style.listItem(selectedId === b.id)}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {b.subject}
              <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
                {b.created_at.slice(0, 10)}
              </span>
            </span>
            <span style={{ flexShrink: 0 }}>
              {b.status === "sent" && b.success_count !== null && (
                <span
                  style={{
                    color: "#9ca3af",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  {String(b.success_count)}/{String(b.recipient_count ?? 0)}{" "}
                  sent
                </span>
              )}
              <span style={style.statusChip(b.status)}>{b.status}</span>
            </span>
          </div>
        ))}
        {!listLoading && broadcasts.length === 0 && (
          <div
            style={{ ...style.cardBody, fontSize: "14px", color: "#6b7280" }}
          >
            No broadcasts yet.
          </div>
        )}
      </div>

      {isEditing && (
        <div style={style.card}>
          <div style={style.cardHeader}>
            {selectedId === null ? "New broadcast" : "Edit draft"}
          </div>
          <div style={style.cardBody}>
            <form
              onSubmit={(e) => {
                void handleSave(e);
              }}
            >
              <div style={{ marginBottom: "12px" }}>
                <label htmlFor="broadcast-subject" style={style.label}>
                  Subject
                </label>
                <input
                  id="broadcast-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                  }}
                  required
                  maxLength={255}
                  disabled={saveLoading}
                  style={{ ...style.input, width: "100%" }}
                  placeholder="Subject line"
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label htmlFor="broadcast-sender" style={style.label}>
                  Sender
                </label>
                <select
                  id="broadcast-sender"
                  value={senderIdentityId}
                  onChange={(e) => {
                    setSenderIdentityId(e.target.value);
                  }}
                  disabled={saveLoading}
                  style={{ ...style.input, width: "100%", maxWidth: "420px" }}
                >
                  {identities.map((identity) => (
                    <option key={identity.id} value={identity.id}>
                      {identity.name} &lt;{identity.email}&gt;
                      {identity.reply_to !== null
                        ? ` · replies to ${identity.reply_to}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label htmlFor="broadcast-content" style={style.label}>
                  Content (HTML)
                </label>
                <textarea
                  id="broadcast-content"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                  }}
                  required
                  disabled={saveLoading}
                  style={style.textarea}
                  placeholder="<p>Hello Fractal…</p>"
                />
                <p style={style.hint}>
                  The standard footer (site links and a per-subscriber
                  unsubscribe link) is added automatically.
                </p>
              </div>
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <button
                  type="submit"
                  disabled={saveLoading}
                  style={style.button(saveLoading)}
                >
                  {saveLoading
                    ? "Saving…"
                    : selectedId === null
                      ? "Create draft"
                      : "Save draft"}
                </button>
                {isDraft && !deleteArmed && (
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={() => {
                      setDeleteArmed(true);
                    }}
                    style={style.dangerButton(deleteLoading)}
                  >
                    Delete draft
                  </button>
                )}
                {isDraft && deleteArmed && (
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
                    {deleteLoading ? "Deleting…" : "Confirm delete"}
                  </button>
                )}
                {broadcast?.test_sent_at != null && (
                  <span style={{ fontSize: "13px", color: "#065f46" }}>
                    ✓ Test sent to {broadcast.test_sent_to}
                  </span>
                )}
                {broadcast !== null && broadcast.test_sent_at === null && (
                  <span style={{ fontSize: "13px", color: "#92400e" }}>
                    Test send required before sending
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {detailLoading && (
        <div style={style.card}>
          <div
            style={{
              ...style.cardBody,
              textAlign: "center" as const,
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Loading…
          </div>
        </div>
      )}

      {broadcast !== null && !isDraft && (
        <div style={style.card}>
          <div style={style.cardHeader}>
            <span>Broadcast details</span>
            <span style={style.statusChip(broadcast.status)}>
              {broadcast.status}
            </span>
          </div>
          <div
            style={{ ...style.cardBody, fontSize: "13px", color: "#374151" }}
          >
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#6b7280", marginRight: "8px" }}>from</span>
              {broadcast.sent_from ?? "—"}
              {broadcast.sent_reply_to !== null && (
                <span style={{ color: "#6b7280", marginLeft: "8px" }}>
                  (replies to {broadcast.sent_reply_to})
                </span>
              )}
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#6b7280", marginRight: "8px" }}>
                sent_at
              </span>
              {broadcast.sent_at !== null
                ? new Date(broadcast.sent_at).toISOString()
                : "—"}
            </div>
            {detail !== null && (
              <div style={{ marginBottom: "8px" }}>
                <span style={{ color: "#6b7280", marginRight: "8px" }}>
                  recipients
                </span>
                {String(detail.counts.sentCount)} sent ·{" "}
                {String(detail.counts.failedCount)} failed ·{" "}
                {String(detail.counts.skippedCount)} skipped ·{" "}
                {String(detail.counts.pendingCount)} pending
              </div>
            )}
          </div>
        </div>
      )}

      {detail !== null && detail.failedRecipients.length > 0 && (
        <div style={style.card}>
          <div style={style.cardHeader}>
            Failed recipients ({String(detail.failedRecipients.length)})
          </div>
          <table style={style.table}>
            <thead>
              <tr>
                <th style={style.th}>Email</th>
                <th style={style.th}>Error</th>
              </tr>
            </thead>
            <tbody>
              {detail.failedRecipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td style={style.td}>{recipient.email}</td>
                  <td style={style.td}>{recipient.error ?? "Unknown error"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail !== null && detail.skippedRecipients.length > 0 && (
        <div style={style.card}>
          <div style={style.cardHeader}>
            Skipped recipients ({String(detail.skippedRecipients.length)})
          </div>
          <table style={style.table}>
            <thead>
              <tr>
                <th style={style.th}>Email</th>
                <th style={style.th}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {detail.skippedRecipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td style={style.td}>{recipient.email}</td>
                  <td style={style.td}>{recipient.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {broadcast !== null && (
        <div style={style.card}>
          <div style={style.cardHeader}>Actions</div>
          <div style={style.cardBody}>
            {isDraft && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-end",
                  flexWrap: "wrap" as const,
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label htmlFor="test-email" style={style.label}>
                    Test send to
                  </label>
                  <input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => {
                      setTestEmail(e.target.value);
                    }}
                    disabled={testLoading}
                    placeholder="your@email.com"
                    style={{ ...style.input, width: "240px" }}
                  />
                </div>
                <button
                  type="button"
                  disabled={testLoading || testEmail.trim() === ""}
                  onClick={() => {
                    void handleTestSend();
                  }}
                  style={style.button(testLoading || testEmail.trim() === "")}
                >
                  {testLoading ? "Sending…" : "Send test"}
                </button>
              </div>
            )}

            {(isDraft || broadcast.status === "failed") && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-end",
                  flexWrap: "wrap" as const,
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label htmlFor="confirm-count" style={style.label}>
                    Type the recipient count ({String(verifiedCount)}) to
                    confirm
                  </label>
                  <input
                    id="confirm-count"
                    type="text"
                    value={confirmCount}
                    onChange={(e) => {
                      setConfirmCount(e.target.value);
                    }}
                    disabled={sendLoading || !isSendable}
                    placeholder={String(verifiedCount)}
                    style={{ ...style.input, width: "240px" }}
                  />
                </div>
                <button
                  type="button"
                  disabled={sendLoading || !isSendable || !sendConfirmed}
                  onClick={() => {
                    void handleSend();
                  }}
                  style={style.button(
                    sendLoading || !isSendable || !sendConfirmed
                  )}
                >
                  {sendLoading
                    ? "Sending…"
                    : broadcast.status === "failed"
                      ? "Retry failed and resume"
                      : emailEnabled
                        ? `Send to ${String(verifiedCount)} subscribers`
                        : "Dry run send"}
                </button>
              </div>
            )}
            {isDraft && broadcast.test_sent_at === null && (
              <p style={style.hint}>
                Send a test email first. Editing the draft after a test clears
                the approval.
              </p>
            )}

            <button
              type="button"
              disabled={duplicateLoading}
              onClick={() => {
                void handleDuplicate();
              }}
              style={style.secondaryButton(duplicateLoading)}
            >
              {duplicateLoading ? "Duplicating…" : "Duplicate as new draft"}
            </button>
          </div>
        </div>
      )}

      {detail !== null && (
        <div style={style.card}>
          <div style={style.cardHeader}>Email preview</div>
          <div
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              maxWidth: "600px",
              margin: "0 auto",
              padding: "20px",
              color: "#1a1a1a",
              fontSize: "16px",
              lineHeight: 1.5,
            }}
            dangerouslySetInnerHTML={{ __html: detail.previewHtml }}
          />
        </div>
      )}

      <div style={style.card}>
        <div style={style.cardHeader}>Sender identities</div>
        <table style={style.table}>
          <thead>
            <tr>
              <th style={style.th}>Name</th>
              <th style={style.th}>Email</th>
              <th style={style.th}>Reply-to</th>
              <th style={style.th} />
            </tr>
          </thead>
          <tbody>
            {identities.map((identity) => (
              <tr key={identity.id}>
                <td style={style.td}>{identity.name}</td>
                <td style={style.td}>{identity.email}</td>
                <td style={style.td}>{identity.reply_to ?? "—"}</td>
                <td style={style.td}>
                  <button
                    type="button"
                    onClick={() => {
                      handleEditIdentity(identity);
                    }}
                    style={{
                      ...style.secondaryButton(false),
                      padding: "4px 10px",
                      fontSize: "12px",
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={style.cardBody}>
          <form
            onSubmit={(e) => {
              void handleSaveIdentity(e);
            }}
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-end",
              flexWrap: "wrap" as const,
            }}
          >
            <div>
              <label htmlFor="identity-name" style={style.label}>
                Name
              </label>
              <input
                id="identity-name"
                type="text"
                value={identityName}
                onChange={(e) => {
                  setIdentityName(e.target.value);
                }}
                required
                maxLength={100}
                disabled={identitySaveLoading}
                placeholder="Fractal Boston"
                style={{ ...style.input, width: "180px" }}
              />
            </div>
            <div>
              <label htmlFor="identity-email" style={style.label}>
                Email {editingIdentityId !== null && "(immutable)"}
              </label>
              <input
                id="identity-email"
                type="email"
                value={identityEmail}
                onChange={(e) => {
                  setIdentityEmail(e.target.value);
                }}
                required
                disabled={identitySaveLoading || editingIdentityId !== null}
                placeholder={`someone@${SENDER_EMAIL_DOMAIN}`}
                style={{ ...style.input, width: "220px" }}
              />
            </div>
            <div>
              <label htmlFor="identity-reply-to" style={style.label}>
                Reply-to (optional)
              </label>
              <input
                id="identity-reply-to"
                type="email"
                value={identityReplyTo}
                onChange={(e) => {
                  setIdentityReplyTo(e.target.value);
                }}
                disabled={identitySaveLoading}
                placeholder="person@example.com"
                style={{ ...style.input, width: "220px" }}
              />
            </div>
            <button
              type="submit"
              disabled={identitySaveLoading}
              style={style.button(identitySaveLoading)}
            >
              {identitySaveLoading
                ? "Saving…"
                : editingIdentityId !== null
                  ? "Save identity"
                  : "Add identity"}
            </button>
            {editingIdentityId !== null && (
              <button
                type="button"
                onClick={handleResetIdentityForm}
                style={style.secondaryButton(false)}
              >
                Cancel
              </button>
            )}
          </form>
          <p style={style.hint}>
            ⚠️ Add sender identities sparingly. Mailbox providers build
            reputation per sending address — a small set of consistent,
            recognizable senders delivers better than a new address for every
            broadcast. Addresses must be @{SENDER_EMAIL_DOMAIN} (covered by the
            domain&apos;s SES verification).
          </p>
        </div>
      </div>
    </div>
  );
}
