import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="text-4xl">🔍</span>
          <div>
            <h1 className="text-xl font-bold text-text-dark">Page not found</h1>
            <p className="mt-1 text-sm text-text-muted">
              This page doesn&apos;t exist, or the set you&apos;re looking for is private.
            </p>
          </div>
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
