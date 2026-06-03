import { db } from "@/db/db";
import { sendInternalError, sendSuccess } from "@/lib/api-response";
import { validateCronSecret } from "@/lib/auth";

type KeepAliveResponse = {
  newSubscribersLastWeek: number;
};

export async function GET(): Promise<Response> {
  const authError = await validateCronSecret();
  if (authError !== null) {
    return authError;
  }

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await db
      .selectFrom("subscribers")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("created_at", ">=", oneWeekAgo)
      .executeTakeFirstOrThrow();

    return sendSuccess<KeepAliveResponse>({
      newSubscribersLastWeek: result.count,
    });
  } catch (error) {
    console.error("Keep-alive cron error:", error);
    return sendInternalError("Failed to query subscribers");
  }
}
