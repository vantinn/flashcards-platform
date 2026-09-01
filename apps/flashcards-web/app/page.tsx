import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { CreateSection } from "@/components/landing/create-section";
import { LearningModesSection } from "@/components/landing/learning-modes-section";
import { CramSection } from "@/components/landing/cram-section";
import { DeepLearningSection } from "@/components/landing/deep-learning-section";
import { DiscoverSection } from "@/components/landing/discover-section";
import { PronunciationSection } from "@/components/landing/pronunciation-section";
import { ProgressSection } from "@/components/landing/progress-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { getCurrentUser } from "@/lib/current-user";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col">
        <HeroSection user={user} />
        <CreateSection />
        <LearningModesSection />
        <CramSection />
        <DeepLearningSection />
        <DiscoverSection />
        <PronunciationSection />
        <ProgressSection />
        <FinalCtaSection user={user} />
      </main>
      <Footer />
    </div>
  );
}
