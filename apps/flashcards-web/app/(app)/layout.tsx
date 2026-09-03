import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { AuthenticatedFooter } from "@/components/layout/authenticated-footer";
import { getCurrentUser } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // proxy.ts already blocks anonymous requests to every route under this
  // group, so `user` is normally always populated here. getCurrentUser()
  // is still tolerant of a null result (rather than throwing) as
  // defense-in-depth for the case where a stale-but-present cookie passes
  // the proxy's presence check but the backend rejects it as invalid.
  const user = await getCurrentUser();

  return (
    <>
      {/* min-h-screen is scoped to nav+content (not the footer) so the
          footer sits below the fold and only appears once the user scrolls
          past a full viewport of app content, instead of being pinned to
          the bottom of the screen on short pages. */}
      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar user={user} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
      <AuthenticatedFooter />
    </>
  );
}
