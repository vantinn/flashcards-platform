"use client"; // error.tsx must be a Client Component per Next.js's file convention

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertTriangleIcon className="h-10 w-10 text-danger" />
          <div>
            <h1 className="text-xl font-bold text-text-dark">{t("common.errorTitle")}</h1>
            <p className="mt-1 text-sm text-text-muted">{t("system.errorDescription")}</p>
          </div>
          <Button onClick={reset}>{t("common.retry")}</Button>
        </CardBody>
      </Card>
    </div>
  );
}
