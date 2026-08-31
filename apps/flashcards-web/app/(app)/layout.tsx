import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Tolerant of anonymous visitors — /explore is public, so this layout
  // can't assume a session exists just because proxy.ts guards /dashboard
  // and /sets specifically.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
