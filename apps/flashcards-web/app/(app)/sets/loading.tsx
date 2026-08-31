import { PageContainer } from "@/components/ui/page-container";

function Block({ className }: { className: string }) {
  return <div className={`skeleton rounded-card ${className}`} />;
}

export default function MySetsLoading() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Block className="h-7 w-56" />
          <Block className="h-4 w-72" />
        </div>
        <Block className="h-10 w-28" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Block className="h-10 w-full max-w-sm" />
        <Block className="h-10 w-[180px]" />
        <Block className="h-10 w-20" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-36 w-full rounded-card-lg" />
        ))}
      </div>
    </PageContainer>
  );
}
