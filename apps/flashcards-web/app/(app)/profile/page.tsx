import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUser } from "@/lib/current-user";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?from=/profile");
  }

  return (
    <PageContainer className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text-dark">Profile</h1>
        <p className="text-text-muted">Update how your name and avatar appear across the app.</p>
      </div>

      <ProfileForm user={user} />
    </PageContainer>
  );
}
