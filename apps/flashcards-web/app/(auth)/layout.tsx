import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4 py-12">
      <div className="mb-8 flex w-full max-w-sm items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          Flashcards
        </Link>
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
