export function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="text-sm font-medium text-text-muted">{label}</p>
    </div>
  );
}
