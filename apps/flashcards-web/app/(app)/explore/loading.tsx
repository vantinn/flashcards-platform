import { PageContainer } from "@/components/ui/page-container";

function Block({ className }: { className: string }) {
  return <div className={`skeleton rounded-card ${className}`} />;
}

export default function ExploreLoading() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Block className="h-7 w-64" />
        <Block className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Block className="h-10 w-full max-w-sm" />
        <Block className="h-10 w-[180px]" />
        <Block className="h-10 w-20" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Block key={i} className="h-36 w-full rounded-card-lg" />
        ))}
      </div>
    </PageContainer>
  );
}
