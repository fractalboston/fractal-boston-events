"use client";

import Link from "next/link";
import type { ReactElement } from "react";

export default function Home(): ReactElement {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Fractal Events API</h1>
      <p>This is an API-only service. No UI here.</p>
      <p>
        <Link href="/api/health">Health Check</Link>
      </p>
      <p>
        <Link href="/events-preview">Events Preview</Link>
      </p>
    </div>
  );
}
