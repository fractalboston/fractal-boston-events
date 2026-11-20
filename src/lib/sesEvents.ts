import { z } from "zod";

const recipientSchema = z.object({
  emailAddress: z.string().min(1),
});

const bounceSchema = z.object({
  bounceType: z.string(),
  bouncedRecipients: z.array(recipientSchema).default([]),
});

const complaintSchema = z.object({
  complainedRecipients: z.array(recipientSchema).default([]),
});

const sesEventSchema = z.object({
  notificationType: z.string().optional(),
  eventType: z.string().optional(),
  bounce: bounceSchema.optional(),
  complaint: complaintSchema.optional(),
});

export type SuppressionAction = {
  email: string;
  status: "bounced" | "complained";
};

export type IgnoredSesRecipient = {
  email: string | undefined;
  reason: string;
};

export type ParsedSesEvent = {
  eventKind: string;
  actions: SuppressionAction[];
  ignored: IgnoredSesRecipient[];
};

function eventKind(event: z.infer<typeof sesEventSchema>): string {
  const kind = event.notificationType ?? event.eventType ?? "";
  return kind.trim().toLowerCase();
}

export function parseSesEventMessage(
  message: string
): ParsedSesEvent | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(message);
  } catch {
    return undefined;
  }
  const parsed = sesEventSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  const event = parsed.data;
  const kind = eventKind(event);
  const actions: SuppressionAction[] = [];
  const ignored: IgnoredSesRecipient[] = [];

  if (kind === "bounce") {
    const bounce = event.bounce;
    if (bounce === undefined) {
      return { eventKind: kind, actions, ignored };
    }
    const bounceType = bounce.bounceType.toLowerCase();
    for (const recipient of bounce.bouncedRecipients) {
      const email = recipient.emailAddress.trim().toLowerCase();
      if (bounceType === "permanent") {
        actions.push({ email, status: "bounced" });
      } else {
        ignored.push({
          email,
          reason: `Ignored ${bounce.bounceType} bounce`,
        });
      }
    }
    return { eventKind: kind, actions, ignored };
  }

  if (kind === "complaint") {
    const complaint = event.complaint;
    if (complaint === undefined) {
      return { eventKind: kind, actions, ignored };
    }
    for (const recipient of complaint.complainedRecipients) {
      actions.push({
        email: recipient.emailAddress.trim().toLowerCase(),
        status: "complained",
      });
    }
    return { eventKind: kind, actions, ignored };
  }

  ignored.push({ email: undefined, reason: `Ignored SES event type: ${kind}` });
  return { eventKind: kind, actions, ignored };
}
