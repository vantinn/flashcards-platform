export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} Flashcards. Learn anything, one card at a time.</p>
      </div>
    </footer>
  );
}
