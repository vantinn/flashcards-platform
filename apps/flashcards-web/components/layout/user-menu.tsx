"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/types/flashcard";

export interface UserMenuProps {
  user: PublicUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
    } finally {
      // Hard navigation, not router.push — see the login page for why:
      // the client Router Cache can hold pages rendered for the now-logged
      // -out user, and a soft navigation can reuse that stale render.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional, see comment above
      window.location.href = "/";
    }
  }

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatarUrl is an arbitrary external URL (user-supplied on the profile page), so next/image's remote-pattern allowlist doesn't apply here.
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open ? (
        <>
          {/* Click-outside catcher */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-48 rounded-card-lg border border-border bg-white py-1 shadow-card-lg"
          >
            <div className="border-b border-border px-4 py-2">
              <p className="truncate text-sm font-medium text-text-dark">{user.displayName}</p>
              <p className="truncate text-xs text-text-muted">{user.email}</p>
            </div>
            <Link
              href="/dashboard"
              role="menuitem"
              className="block px-4 py-2 text-sm text-text-dark hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/sets"
              role="menuitem"
              className="block px-4 py-2 text-sm text-text-dark hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              My sets
            </Link>
            <Link
              href="/profile"
              role="menuitem"
              className="block px-4 py-2 text-sm text-text-dark hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={loggingOut}
              className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
