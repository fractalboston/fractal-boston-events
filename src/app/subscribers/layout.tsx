import { notFound } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { isDevelopment } from "@/lib/env";

export default function SubscribersLayout({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  if (!isDevelopment()) {
    notFound();
  }
  return <>{children}</>;
}
