export interface ErrorStateProps {
  title: string;
  description?: string;
}

export function ErrorState({ title, description }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card-lg border border-danger/30 bg-danger/5 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold text-danger">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-text-muted">{description}</p> : null}
    </div>
  );
}
