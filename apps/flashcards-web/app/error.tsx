"use client"; // error.tsx must be a Client Component per Next.js's file convention

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="text-4xl">⚠️</span>
          <div>
            <h1 className="text-xl font-bold text-text-dark">Something went wrong</h1>
            <p className="mt-1 text-sm text-text-muted">
              An unexpected error occurred. Please try again.
            </p>
          </div>
          <Button onClick={reset}>Try again</Button>
        </CardBody>
      </Card>
    </div>
  );
}
