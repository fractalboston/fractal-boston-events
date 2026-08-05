import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { SESSION_COOKIE_NAME } from "@/lib/passkey/config";
import { countUsers } from "@/lib/passkey/db";
import { getSessionUserFromCookieHeader } from "@/lib/passkey/session";

async function requireAdminPage(): Promise<void> {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const cookieHeader = sessionCookie
    ? `${SESSION_COOKIE_NAME}=${sessionCookie.value}`
    : null;
  const user = await getSessionUserFromCookieHeader(cookieHeader);
  if (!user) {
    redirect("/login");
  }
}

export default async function AdminGateLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  await requireAdminPage();
  return <>{children}</>;
}
