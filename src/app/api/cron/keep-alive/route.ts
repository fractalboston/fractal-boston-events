import { db } from "@/db/db";
import {
  notAllowed,
  sendInternalError,
  sendSuccess,
  withHandler,
} from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";

type KeepAliveResponse = {
  newSubscribersLastWeek: number;
};

export const GET = withHandler(async (): Promise<Response> => {
  const authError = await validateCronSecret();
  if (authError !== null) {
    return authError;
  }

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await db
      .selectFrom("subscribers")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("created_at", ">=", oneWeekAgo)
      .executeTakeFirstOrThrow();

    return sendSuccess<KeepAliveResponse>({
      newSubscribersLastWeek: parseInt(result.count, 10),
    });
  } catch (error) {
    console.error("Keep-alive cron error:", error);
    return sendInternalError("Failed to query subscribers");
  }
});

export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
