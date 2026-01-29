"use client";

import { useState } from "react";
import type { ReactElement } from "react";

type ResponseData = {
  success: boolean;
  data?: { message: string };
  error?: string;
};

export default function TestEmailPage(): ReactElement {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(
    e: Parameters<React.SubmitEventHandler<HTMLFormElement>>[0]
  ): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as ResponseData;

      if (data.success) {
        setMessage({
          type: "success",
          text: data.data?.message ?? "Email sent successfully!",
        });
        setEmail("");
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
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "system-ui",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>
        Send Test Email
      </h1>
      <p style={{ marginBottom: "24px", color: "#666" }}>
        Enter an email address to send yourself a test email.
      </p>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            required
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              boxSizing: "border-box",
            }}
            placeholder="your@email.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: loading ? "#999" : "#2563eb",
            color: "white",
            padding: "12px 24px",
            fontSize: "16px",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send Test Email"}
        </button>
      </form>

      {message && (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            borderRadius: "6px",
            border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
