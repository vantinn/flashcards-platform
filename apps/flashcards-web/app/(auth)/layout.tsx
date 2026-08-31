import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4 py-12">
      <Link href="/" className="mb-8 text-xl font-bold text-primary">
        Flashcards
      </Link>
      {children}
    </div>
  );
}
