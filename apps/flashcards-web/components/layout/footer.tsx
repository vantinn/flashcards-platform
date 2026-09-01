import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/sets/create", label: "Create flashcard set" },
      { href: "/explore", label: "Explore public sets" },
      { href: "/sets", label: "My flashcard sets" },
    ],
  },
  {
    heading: "Learning",
    links: [
      { href: "/#learning-modes", label: "Study modes" },
      { href: "/#cram", label: "Cram Mode" },
      { href: "/#deep-learning", label: "Deep Learning" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Register" },
      { href: "/profile", label: "Profile" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Link href="/" className="text-lg font-bold text-primary">
              Flashcards
            </Link>
            <p className="text-sm text-text-muted">Learn anything, one card at a time.</p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-dark">{column.heading}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-text-muted hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-border pt-6 text-sm text-text-muted">
          © {new Date().getFullYear()} Flashcards. Learn anything, one card at a time.
        </p>
      </div>
    </footer>
  );
}
