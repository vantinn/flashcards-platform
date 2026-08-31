import { PageContainer } from "@/components/ui/page-container";
import { Card, CardBody } from "@/components/ui/card";

function Block({ className }: { className: string }) {
  return <div className={`skeleton rounded-card ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <PageContainer className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Block className="h-7 w-64" />
        <Block className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-12 w-40" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardBody className="flex flex-col gap-2">
              <Block className="h-4 w-24" />
              <Block className="h-8 w-12" />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Block className="h-6 w-40" />
        <Block className="h-20 w-full rounded-card-lg" />
      </div>

      <div className="flex flex-col gap-4">
        <Block className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Block key={i} className="h-32 w-full rounded-card-lg" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
