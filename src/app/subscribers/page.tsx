"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { BRAND_COLOR } from "@/lib/constants";

type Subscriber = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  token: string;
  status: "pending" | "verified" | "unsubscribed" | "bounced" | "complained";
  source: "form" | "luma" | "substack" | "manual";
  last_emailed_at: string | null;
  last_broadcast_at: string | null;
};

type SearchResponse = {
  success: boolean;
  data?: {
    subscribers: Subscriber[];
    hasMore: boolean;
    nextOffset: number;
    totalCount: number;
  };
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
  "bounced",
  "complained",
];
const SEARCH_DEBOUNCE_MS = 500;
const PAGE_SIZE = 50;

type SortOption = "newest" | "alphabetical" | "last_emailed";
type StatusFilter = "all" | Subscriber["status"];

export default function SubscribersPage(): ReactElement {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("verified");
  const [results, setResults] = useState<Subscriber[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasLoadedResults, setHasLoadedResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [editEmail, setEditEmail] = useState("");
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
  const [showAddSubscriberForm, setShowAddSubscriberForm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeSearchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return (): void => {
      clearTimeout(timeout);
    };
  }, [query]);

  const runSearch = useCallback(
    async ({
      q,
      sortBy,
      status,
      offset,
      append,
    }: {
      q: string;
      sortBy: SortOption;
      status: StatusFilter;
      offset: number;
      append: boolean;
    }): Promise<void> => {
      if (append) {
        setLoadMoreLoading(true);
      } else {
        setSearchLoading(true);
        setMessage(null);
      }

      activeSearchControllerRef.current?.abort();
      const controller = new AbortController();
      activeSearchControllerRef.current = controller;

      try {
        const params = new URLSearchParams();
        params.set("q", q);
        params.set("sort", sortBy);
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", offset.toString());
        if (status !== "all") {
          params.set("status", status);
        }
        const response = await fetch(`/api/subscribers?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as SearchResponse;
        if (data.success && data.data?.subscribers !== undefined) {
          const subscribers = data.data.subscribers;
          setResults((previous) => {
            if (!append) {
              return subscribers;
            }
            return [...previous, ...subscribers];
          });
          setHasMore(data.data.hasMore);
          setNextOffset(data.data.nextOffset);
          setTotalCount(data.data.totalCount);
          if (!append) {
            setSelected(null);
          }
        } else if (!append) {
          setResults([]);
          setHasMore(false);
          setNextOffset(0);
          setTotalCount(0);
          setMessage({
            type: "error",
            text: data.error ?? "Search failed",
          });
        } else {
          setMessage({
            type: "error",
            text: data.error ?? "Failed to load more subscribers",
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const err = error instanceof Error ? error : new Error(String(error));
        if (!append) {
          setResults([]);
          setHasMore(false);
          setNextOffset(0);
          setTotalCount(0);
        }
        setMessage({ type: "error", text: err.message });
      } finally {
        if (activeSearchControllerRef.current === controller) {
          activeSearchControllerRef.current = null;
          setSearchLoading(false);
          setLoadMoreLoading(false);
          setHasLoadedResults(true);
        }
      }
    },
    []
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void runSearch({
        q: debouncedQuery,
        sortBy: sort,
        status: statusFilter,
        offset: 0,
        append: false,
      });
    }, 0);

    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [debouncedQuery, runSearch, sort, statusFilter]);

  const loadMore = useCallback((): void => {
    if (!hasMore || searchLoading || loadMoreLoading) {
      return;
    }

    void runSearch({
      q: debouncedQuery,
      sortBy: sort,
      status: statusFilter,
      offset: nextOffset,
      append: true,
    });
  }, [
    debouncedQuery,
    hasMore,
    loadMoreLoading,
    nextOffset,
    runSearch,
    searchLoading,
    sort,
    statusFilter,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (target === null || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "120px" }
    );

    observer.observe(target);

    return (): void => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  useEffect(() => {
    return (): void => {
      activeSearchControllerRef.current?.abort();
    };
  }, []);

  function handleSelectSubscriber(s: Subscriber): void {
    setSelected(s);
    setEditEmail(s.email);
    setEditSource(s.source);
    setEditStatus(s.status);
    setMessage(null);
  }

  function escapeCsvField(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }

  function downloadCsv({
    rows,
  }: {
    rows: Pick<Subscriber, "id" | "email" | "status">[];
  }): void {
    const header = "id,email,status";
    const body = rows
      .map(
        (row) =>
          `${escapeCsvField(row.id)},${escapeCsvField(row.email)},${escapeCsvField(row.status)}`
      )
      .join("\n");
    const csv = `${header}\n${body}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const statusPart = statusFilter === "all" ? "all" : statusFilter;
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `subscribers-${statusPart}-${datePart}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportCsv(): Promise<void> {
    if (exportLoading || totalCount === 0) {
      return;
    }
    setExportLoading(true);
    setMessage(null);
    try {
      const exportPageSize = 100;
      const allRows: Pick<Subscriber, "id" | "email" | "status">[] = [];
      let offset = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const params = new URLSearchParams();
        params.set("q", debouncedQuery);
        params.set("sort", sort);
        params.set("limit", exportPageSize.toString());
        params.set("offset", offset.toString());
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        const response = await fetch(`/api/subscribers?${params.toString()}`);
        const data = (await response.json()) as SearchResponse;
        if (!data.success || data.data?.subscribers === undefined) {
          setMessage({
            type: "error",
            text: data.error ?? "Export failed",
          });
          return;
        }
        for (const subscriber of data.data.subscribers) {
          allRows.push({
            id: subscriber.id,
            email: subscriber.email,
            status: subscriber.status,
          });
        }
        hasMorePages = data.data.hasMore;
        offset = data.data.nextOffset;
      }

      downloadCsv({ rows: allRows });
      setMessage({
        type: "success",
        text: `Exported ${String(allRows.length)} subscriber${allRows.length !== 1 ? "s" : ""} to CSV.`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: err.message });
    } finally {
      setExportLoading(false);
    }
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
        setEditEmail(data.data.subscriber.email);
        setEditSource(data.data.subscriber.source);
        setEditStatus(data.data.subscriber.status);
        void runSearch({
          q: debouncedQuery,
          sortBy: sort,
          status: statusFilter,
          offset: 0,
          append: false,
        });
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
    if (editEmail.trim() === "") {
      setMessage({
        type: "error",
        text: "Enter an email address",
      });
      return;
    }
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
          email: editEmail.trim(),
          source: editSource,
          status: editStatus,
        }),
      });
      const data = (await response.json()) as UpdateResponse;
      if (data.success && data.data?.subscriber !== undefined) {
        setSelected(data.data.subscriber);
        setEditEmail(data.data.subscriber.email);
        setEditSource(data.data.subscriber.source);
        setEditStatus(data.data.subscriber.status);
        setMessage({ type: "success", text: "Subscriber updated." });
        void runSearch({
          q: debouncedQuery,
          sortBy: sort,
          status: statusFilter,
          offset: 0,
          append: false,
        });
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
        void runSearch({
          q: debouncedQuery,
          sortBy: sort,
          status: statusFilter,
          offset: 0,
          append: false,
        });
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
      maxWidth: "1400px",
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
      backgroundColor: disabled ? "#9ca3af" : BRAND_COLOR,
      color: "white",
      padding: "8px 16px",
      fontSize: "14px",
      border: "none",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "500",
    }),
    secondaryButton: (disabled: boolean): CSSProperties => ({
      backgroundColor: "transparent",
      color: disabled ? "#9ca3af" : "#6b7280",
      padding: "6px 12px",
      fontSize: "13px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "400",
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
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
    },
    chevron: {
      fontSize: "12px",
      color: "#9ca3af",
      transition: "transform 0.2s",
      userSelect: "none" as const,
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
    <>
      <style>{`
        @media (min-width: 1024px) {
          .subscribers-content-wrapper {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
          }
          .subscribers-left-column {
            flex: 0 0 400px !important;
          }
          .subscribers-right-column {
            flex: 1 1 auto !important;
            position: sticky !important;
            top: 2rem !important;
            max-height: calc(100vh - 4rem) !important;
            overflow-y: auto !important;
          }
          .add-subscriber-form {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .add-subscriber-form > div {
            flex: 1 1 auto !important;
            width: 100% !important;
          }
          .add-subscriber-button {
            width: 100% !important;
          }
        }
      `}</style>
      <div style={style.page}>
        <Link href="/" style={style.backLink}>
          ← Home
        </Link>
        <h1 style={style.h1}>Subscribers</h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
          className="subscribers-content-wrapper"
        >
          <div
            style={{
              flex: "0 0 auto",
              minWidth: 0,
            }}
            className="subscribers-left-column"
          >
            <div style={style.formRow}>
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
                  style={style.input}
                />
              </div>
              <div>
                <label htmlFor="subscriber-sort" style={style.label}>
                  Sort
                </label>
                <select
                  id="subscriber-sort"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortOption);
                  }}
                  style={{ ...style.input, width: "180px" }}
                >
                  <option value="newest">Newest first</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                  <option value="last_emailed">Last emailed</option>
                </select>
              </div>
              <div>
                <label htmlFor="subscriber-status-filter" style={style.label}>
                  Status
                </label>
                <select
                  id="subscriber-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter);
                  }}
                  style={{ ...style.input, width: "180px" }}
                >
                  <option value="all">All statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ ...style.card, marginBottom: "20px" }}>
              <div
                style={style.cardHeader}
                onClick={() => {
                  setShowAddSubscriberForm(!showAddSubscriberForm);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowAddSubscriberForm(!showAddSubscriberForm);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span>Add Subscriber</span>
                <span
                  style={{
                    ...style.chevron,
                    transform: showAddSubscriberForm
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  }}
                >
                  ▼
                </span>
              </div>
              {showAddSubscriberForm && (
                <div style={{ padding: "16px" }}>
                  <form
                    onSubmit={(e) => {
                      void handleCreate(e);
                    }}
                    className="add-subscriber-form"
                    style={{
                      display: "flex",
                      flexWrap: "nowrap",
                      gap: "12px",
                      alignItems: "flex-end",
                    }}
                  >
                    <div style={{ flex: "1.5 1 0", minWidth: 0 }}>
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
                        style={{ ...style.input, width: "100%" }}
                      />
                    </div>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
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
                        style={{ ...style.input, width: "100%" }}
                      >
                        {SOURCES.map((src) => (
                          <option key={src} value={src}>
                            {src}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
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
                        style={{ ...style.input, width: "100%" }}
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
                      className="add-subscriber-button"
                      style={{ ...style.button(createLoading), flexShrink: 0 }}
                    >
                      {createLoading ? "Adding…" : "Add"}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {message && (
              <div style={style.message(message.type)}>{message.text}</div>
            )}

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
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => {
                        setEditEmail(e.target.value);
                      }}
                      disabled={updateLoading}
                      style={{
                        ...style.input,
                        width: "100%",
                        maxWidth: "400px",
                        marginTop: "4px",
                      }}
                    />
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
                  <div style={style.detailRow}>
                    <span style={style.detailKey}>last_emailed_at</span>
                    {selected.last_emailed_at !== null
                      ? new Date(selected.last_emailed_at).toISOString()
                      : "never"}
                  </div>
                  <div style={style.detailRow}>
                    <span style={style.detailKey}>last_broadcast_at</span>
                    {selected.last_broadcast_at !== null
                      ? new Date(selected.last_broadcast_at).toISOString()
                      : "never"}
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

            {hasLoadedResults &&
              !searchLoading &&
              results.length === 0 &&
              message === null && (
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  {query.trim() === ""
                    ? "No subscribers found."
                    : `No subscribers match "${query.trim()}".`}
                </p>
              )}
          </div>

          {results.length > 0 && (
            <div
              style={{
                flex: "1 1 auto",
                minWidth: 0,
              }}
              className="subscribers-right-column"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "8px",
                }}
              >
                <button
                  type="button"
                  disabled={exportLoading || totalCount === 0}
                  onClick={() => {
                    void handleExportCsv();
                  }}
                  style={style.secondaryButton(
                    exportLoading || totalCount === 0
                  )}
                >
                  {exportLoading ? "Exporting…" : "Export CSV"}
                </button>
              </div>
              <div style={style.card}>
                <div style={{ ...style.cardHeader, cursor: "default" }}>
                  {totalCount} subscriber{totalCount !== 1 ? "s" : ""}
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
                <div ref={loadMoreRef} style={{ height: "1px" }} />
                {(loadMoreLoading || hasMore) && (
                  <div
                    style={{
                      padding: "12px 16px",
                      fontSize: "13px",
                      color: "#6b7280",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    {loadMoreLoading
                      ? "Loading more..."
                      : "Scroll to load more"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
                This will permanently remove {selected.email} from the list.
                This cannot be undone.
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
      </div>
    </>
  );
}
