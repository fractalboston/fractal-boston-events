import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type SnsEnvelope,
  isAllowedSnsUrl,
  parseSnsEnvelope,
  stringToSign,
  verifySnsSignature,
} from "@/lib/sns";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__"
);
const testCert = readFileSync(join(fixturesDir, "sns-test-cert.pem"), "utf8");
const testKey = readFileSync(join(fixturesDir, "sns-test-key.pem"), "utf8");

function signEnvelope(envelope: SnsEnvelope): string {
  const signer = createSign(
    envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1"
  );
  signer.update(stringToSign(envelope), "utf8");
  signer.end();
  return signer.sign(testKey, "base64");
}

describe("isAllowedSnsUrl", () => {
  it("accepts a regional SNS signing cert URL", () => {
    expect(
      isAllowedSnsUrl({
        value:
          "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
        kind: "cert",
      })
    ).toBe(true);
  });

  it("accepts a ConfirmSubscription URL on the SNS host", () => {
    expect(
      isAllowedSnsUrl({
        value:
          "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=arn:aws:sns:us-east-1:123:topic&Token=abc",
        kind: "subscribe",
      })
    ).toBe(true);
  });

  it("rejects cert URLs that are not on an SNS amazonaws.com host", () => {
    const rejected = [
      "http://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
      "https://sns.us-east-1.amazonaws.com.evil.com/SimpleNotificationService-abc123.pem",
      "https://evil.com/sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
      "https://user:pass@sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
      "https://sns.us-east-1.amazonaws.com/not-the-cert.pem",
      "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem?x=1",
    ];
    for (const value of rejected) {
      expect(isAllowedSnsUrl({ value, kind: "cert" }), value).toBe(false);
    }
  });
});

describe("parseSnsEnvelope and stringToSign", () => {
  it("accepts a Notification envelope and signs fields in AWS order", () => {
    const envelope = parseSnsEnvelope({
      Type: "Notification",
      MessageId: "msg-1",
      TopicArn: "arn:aws:sns:us-east-1:123:topic",
      Message: "{}",
      Timestamp: "2026-11-20T00:00:00.000Z",
      SignatureVersion: "1",
      Signature: "abc",
      SigningCertURL:
        "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
    });
    if (envelope === undefined) {
      throw new Error("expected a Notification envelope");
    }
    expect(envelope.Type).toBe("Notification");
    expect(stringToSign(envelope)).toBe(
      "Message\n{}\nMessageId\nmsg-1\nTimestamp\n2026-11-20T00:00:00.000Z\nTopicArn\narn:aws:sns:us-east-1:123:topic\nType\nNotification\n"
    );
  });

  it("includes SubscribeURL and Token for SubscriptionConfirmation", () => {
    const envelope: SnsEnvelope = {
      Type: "SubscriptionConfirmation",
      MessageId: "msg-1",
      TopicArn: "arn:aws:sns:us-east-1:123:topic",
      Message: "confirm",
      Timestamp: "2026-11-20T00:00:00.000Z",
      SignatureVersion: "1",
      Signature: "abc",
      SigningCertURL:
        "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
      SubscribeURL:
        "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=t",
      Token: "t",
    };
    expect(stringToSign(envelope)).toContain("SubscribeURL\n");
    expect(stringToSign(envelope)).toContain("Token\nt\n");
  });

  it("rejects an incomplete envelope", () => {
    expect(parseSnsEnvelope({ Type: "Notification" })).toBeUndefined();
  });
});

describe("verifySnsSignature", () => {
  const baseEnvelope: SnsEnvelope = {
    Type: "Notification",
    MessageId: "msg-1",
    TopicArn: "arn:aws:sns:us-east-1:123:topic",
    Message: "{}",
    Timestamp: "2026-11-20T00:00:00.000Z",
    SignatureVersion: "1",
    Signature: "aa",
    SigningCertURL:
      "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc123.pem",
  };

  it("rejects a topic ARN mismatch without fetching the cert", async () => {
    const verified = await verifySnsSignature({
      envelope: {
        ...baseEnvelope,
        TopicArn: "arn:aws:sns:us-east-1:123:other",
      },
      expectedTopicArn: baseEnvelope.TopicArn,
      fetchCert: () =>
        Promise.reject(new Error("should not fetch cert for a topic mismatch")),
    });
    expect(verified).toBe(false);
  });

  it("rejects a disallowed SigningCertURL without fetching", async () => {
    const verified = await verifySnsSignature({
      envelope: {
        ...baseEnvelope,
        SigningCertURL:
          "https://evil.example/SimpleNotificationService-abc123.pem",
      },
      expectedTopicArn: baseEnvelope.TopicArn,
      fetchCert: () =>
        Promise.reject(
          new Error("should not fetch a cert from a disallowed URL")
        ),
    });
    expect(verified).toBe(false);
  });

  it("accepts a valid SignatureVersion 1 signature", async () => {
    const unsigned = { ...baseEnvelope };
    const envelope = { ...unsigned, Signature: signEnvelope(unsigned) };
    const verified = await verifySnsSignature({
      envelope,
      expectedTopicArn: envelope.TopicArn,
      fetchCert: () => Promise.resolve(testCert),
    });
    expect(verified).toBe(true);
  });

  it("accepts a valid SignatureVersion 2 signature", async () => {
    const unsigned = { ...baseEnvelope, SignatureVersion: "2" as const };
    const envelope = { ...unsigned, Signature: signEnvelope(unsigned) };
    const verified = await verifySnsSignature({
      envelope,
      expectedTopicArn: envelope.TopicArn,
      fetchCert: () => Promise.resolve(testCert),
    });
    expect(verified).toBe(true);
  });

  it("rejects a tampered message", async () => {
    const unsigned = { ...baseEnvelope };
    const envelope = {
      ...unsigned,
      Signature: signEnvelope(unsigned),
      Message: "tampered",
    };
    const verified = await verifySnsSignature({
      envelope,
      expectedTopicArn: envelope.TopicArn,
      fetchCert: () => Promise.resolve(testCert),
    });
    expect(verified).toBe(false);
  });
});
