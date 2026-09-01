import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { ProfileForm } from "@/components/profile/profile-form";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getCurrentUser } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=/profile");
  }
  const dict = getDictionary(await getLocale());

  return (
    <PageContainer className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-dark">{dict.profile.title}</h1>
        <p className="text-text-muted">{dict.profile.subtitle}</p>
      </div>

      <ProfileForm user={user} />

      <div className="flex items-center justify-between rounded-card-lg border border-border bg-white p-5 shadow-card">
        <span className="text-sm font-medium text-text-dark">{dict.languageSwitcher.label}</span>
        <LanguageSwitcher />
      </div>
    </PageContainer>
  );
}
