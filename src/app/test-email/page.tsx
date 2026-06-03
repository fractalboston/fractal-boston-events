"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { BRAND_COLOR } from "@/lib/constants";

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

type PreviewResponseData = {
  success: boolean;
  data?: {
    simple: { from: string; subject: string; html: string };
    detailed: { from: string; subject: string; html: string };
  };
  error?: string;
};

type SendEmailResponseData = {
  success: boolean;
  data?: { message: string };
  error?: string;
};

type SendDiscordResponseData = {
  success: boolean;
  data?: { message: string };
  error?: string;
};

export default function TestEmailPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [asOfDate, setAsOfDate] = useState(todayYYYYMMDD);
  const [preview, setPreview] = useState<{
    simple: { from: string; subject: string; html: string };
    detailed: { from: string; subject: string; html: string };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchPreview = useCallback(async (date: string): Promise<void> => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch(
        `/api/test-email/preview?date=${encodeURIComponent(date)}`
      );
      const data = (await response.json()) as PreviewResponseData;
      if (data.success && data.data !== undefined) {
        setPreview(data.data);
      } else {
        setPreviewError(data.error ?? "Failed to load preview");
        setPreview(null);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setPreviewError(err.message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPreview(asOfDate);
    }, 0);

    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [asOfDate, fetchPreview]);

  async function handleSubmit(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): Promise<void> {
    e.preventDefault();
    setEmailLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, asOfDate }),
      });

      const data = (await response.json()) as SendEmailResponseData;

      if (data.success) {
        setMessage({
          type: "success",
          text: data.data?.message ?? "Email sent successfully!",
        });
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to send email",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleSendDiscord(): Promise<void> {
    setDiscordLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/test-discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ asOfDate }),
      });

      const data = (await response.json()) as SendDiscordResponseData;

      if (data.success) {
        setMessage({
          type: "success",
          text:
            data.data?.message ??
            "Test weekly summary sent to Discord logging channel.",
        });
        // Keep asOfDate unchanged so the selected preview date persists
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to send to Discord",
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setMessage({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setDiscordLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "680px",
        margin: "0 auto",
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <Link
        href="/"
        style={{
          display: "inline-block",
          marginBottom: "16px",
          fontSize: "14px",
          color: BRAND_COLOR,
          textDecoration: "none",
        }}
      >
        ← Home
      </Link>
      <h1 style={{ fontSize: "22px", marginBottom: "8px", color: "#111" }}>
        Send Test Email
      </h1>
      <p style={{ marginBottom: "20px", fontSize: "14px", color: "#6b7280" }}>
        Choose a date to preview the email as it would look if sent that day.
        The preview below uses the same content that will be sent.
      </p>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "16px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label
            htmlFor="asOfDate"
            style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "500",
              fontSize: "13px",
              color: "#374151",
            }}
          >
            Preview date
          </label>
          <input
            id="asOfDate"
            type="date"
            value={asOfDate}
            min={todayYYYYMMDD()}
            onChange={(e) => {
              setAsOfDate(e.target.value);
            }}
            style={{
              padding: "8px 12px",
              fontSize: "14px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              boxSizing: "border-box",
              backgroundColor: "#fff",
            }}
          />
        </div>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "500",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              Send to
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              required
              disabled={emailLoading}
              style={{
                width: "220px",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                boxSizing: "border-box",
                backgroundColor: "#fff",
              }}
              placeholder="your@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={emailLoading}
            style={{
              backgroundColor: emailLoading ? "#9ca3af" : BRAND_COLOR,
              color: "white",
              padding: "8px 16px",
              fontSize: "14px",
              border: "none",
              borderRadius: "6px",
              cursor: emailLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {emailLoading ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            disabled={discordLoading}
            onClick={() => {
              void handleSendDiscord();
            }}
            style={{
              backgroundColor: discordLoading ? "#9ca3af" : "#5865f2",
              color: "white",
              padding: "8px 16px",
              fontSize: "14px",
              border: "none",
              borderRadius: "6px",
              cursor: discordLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {discordLoading ? "Sending…" : "Send to Discord"}
          </button>
        </form>
      </div>

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          HTML email preview
        </div>
        {previewLoading ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Loading…
          </div>
        ) : previewError != null && previewError !== "" ? (
          <div
            style={{
              padding: "20px",
              color: "#991b1b",
              fontSize: "14px",
            }}
          >
            {previewError}
          </div>
        ) : preview ? (
          <>
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "#9ca3af", marginRight: "8px" }}>
                  From
                </span>
                {preview.detailed.from}
              </div>
              <div>
                <span style={{ color: "#9ca3af", marginRight: "8px" }}>
                  Subject
                </span>
                {preview.detailed.subject}
              </div>
            </div>
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
              dangerouslySetInnerHTML={{ __html: preview.detailed.html }}
            />
          </>
        ) : null}
      </div>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          Basic email preview
        </div>
        {previewLoading ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Loading…
          </div>
        ) : previewError != null && previewError !== "" ? (
          <div
            style={{
              padding: "20px",
              color: "#991b1b",
              fontSize: "14px",
            }}
          >
            {previewError}
          </div>
        ) : preview ? (
          <>
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: "13px",
                color: "#374151",
              }}
            >
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "#9ca3af", marginRight: "8px" }}>
                  From
                </span>
                {preview.simple.from}
              </div>
              <div>
                <span style={{ color: "#9ca3af", marginRight: "8px" }}>
                  Subject
                </span>
                {preview.simple.subject}
              </div>
            </div>
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
              dangerouslySetInnerHTML={{ __html: preview.simple.html }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
