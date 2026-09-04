import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.legal.privacyTitle };
}

export default async function PrivacyPage() {
  const [user, dict] = await Promise.all([getCurrentUser(), getLocale().then(getDictionary)]);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col">
        <PageContainer className="flex max-w-3xl flex-col gap-4 py-12">
          <h1 className="text-2xl font-bold text-text-dark">{dict.legal.privacyTitle}</h1>
          {dict.legal.privacyBody.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-text-muted">
              {paragraph}
            </p>
          ))}
        </PageContainer>
      </main>
      <Footer />
    </div>
  );
}
