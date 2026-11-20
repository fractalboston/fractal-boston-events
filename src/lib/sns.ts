import { X509Certificate, createVerify } from "node:crypto";
import { z } from "zod";

const snsEnvelopeSchema = z.object({
  Type: z.enum([
    "Notification",
    "SubscriptionConfirmation",
    "UnsubscribeConfirmation",
  ]),
  MessageId: z.string().min(1),
  TopicArn: z.string().min(1),
  Message: z.string(),
  Timestamp: z.string().min(1),
  SignatureVersion: z.enum(["1", "2"]),
  Signature: z.string().min(1),
  SigningCertURL: z.string().min(1),
  SubscribeURL: z.string().optional(),
  Token: z.string().optional(),
  Subject: z.string().optional(),
});

export type SnsEnvelope = z.infer<typeof snsEnvelopeSchema>;

const SNS_CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;
const SNS_CERT_PATH = /^\/SimpleNotificationService-[A-Za-z0-9-]+\.pem$/;

export function parseSnsEnvelope(body: unknown): SnsEnvelope | undefined {
  const parsed = snsEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data;
}

/**
 * SigningCertURL and SubscribeURL must be HTTPS URLs on the regional SNS
 * endpoint, with no credentials in the URL.
 */
export function isAllowedSnsUrl({
  value,
  kind,
}: {
  value: string;
  kind: "cert" | "subscribe";
}): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }
  if (!SNS_CERT_HOST.test(url.hostname)) {
    return false;
  }
  if (kind === "cert") {
    return SNS_CERT_PATH.test(url.pathname) && url.search === "";
  }
  return url.pathname === "/" || url.pathname === "";
}

export function stringToSign(envelope: SnsEnvelope): string {
  const fields: (keyof SnsEnvelope)[] =
    envelope.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];

  let result = "";
  for (const field of fields) {
    const value = envelope[field];
    if (value !== undefined) {
      result += `${field}\n${value}\n`;
    }
  }
  return result;
}

const certCache = new Map<string, string>();

async function fetchSigningCert(certUrl: string): Promise<string> {
  const cached = certCache.get(certUrl);
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(certUrl, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch SNS signing certificate: ${String(response.status)}`
    );
  }
  const pem = await response.text();
  // Throws if the PEM is not a certificate
  new X509Certificate(pem);
  certCache.set(certUrl, pem);
  return pem;
}

export async function verifySnsSignature({
  envelope,
  expectedTopicArn,
  fetchCert = fetchSigningCert,
}: {
  envelope: SnsEnvelope;
  expectedTopicArn: string;
  fetchCert?: (certUrl: string) => Promise<string>;
}): Promise<boolean> {
  if (envelope.TopicArn !== expectedTopicArn) {
    return false;
  }
  if (!isAllowedSnsUrl({ value: envelope.SigningCertURL, kind: "cert" })) {
    return false;
  }
  const pem = await fetchCert(envelope.SigningCertURL);
  const algorithm =
    envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  const verifier = createVerify(algorithm);
  verifier.update(stringToSign(envelope), "utf8");
  verifier.end();
  return verifier.verify(pem, envelope.Signature, "base64");
}
