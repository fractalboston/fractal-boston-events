import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactElement } from "react";
import { SESSION_COOKIE_NAME } from "@/lib/passkey/config";
import { countUsers } from "@/lib/passkey/db";
import { getSessionUserFromCookieHeader } from "@/lib/passkey/session";

export default async function Home(): Promise<ReactElement> {
  const userCount = await countUsers();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const cookieHeader = sessionCookie
    ? `${SESSION_COOKIE_NAME}=${sessionCookie.value}`
    : null;
  const user = await getSessionUserFromCookieHeader(cookieHeader);
  const loggedIn = user !== null;

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Fractal Events API</h1>
      <p>This is an API-only service with a small admin UI.</p>
      <p>
        <Link href="/api/health">Health Check</Link>
      </p>
      {userCount === 0 && (
        <p>
          <Link href="/login">Admin setup</Link> — create the first passkey.
        </p>
      )}
      {userCount > 0 && !loggedIn && (
        <p>
          <Link href="/login">Sign in</Link>
        </p>
      )}
      {loggedIn && (
        <>
          <p>
            <Link href="/broadcasts">Broadcasts</Link> — compose and send
            one-off emails to the list.
          </p>
          <p>
            <Link href="/subscribers">Subscribers</Link> — search and edit
            subscriber records.
          </p>
          <p>
            <Link href="/test-email">Testing</Link>
          </p>
          <p>
            <Link href="/settings">Settings</Link> — invites and log out.
          </p>
        </>
      )}
    </div>
  );
}
