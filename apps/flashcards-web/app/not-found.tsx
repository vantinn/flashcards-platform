import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SearchIcon } from "@/components/ui/icons";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator } from "@/lib/i18n/dictionary";

export default async function NotFound() {
  const t = createTranslator(getDictionary(await getLocale()));

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-light px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          <SearchIcon className="h-10 w-10 text-text-muted" />
          <div>
            <h1 className="text-xl font-bold text-text-dark">{t("system.notFoundTitle")}</h1>
            <p className="mt-1 text-sm text-text-muted">{t("system.notFoundDescription")}</p>
          </div>
          <Link href="/">
            <Button>{t("system.backToHome")}</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
