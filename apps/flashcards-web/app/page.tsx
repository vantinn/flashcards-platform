import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { getCurrentUser } from "@/lib/current-user";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Navbar user={user} />
      <main className="flex flex-1 flex-col">
        <PageContainer className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
          <span className="animate-fade-in rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">
            Learn anything, one card at a time
          </span>
          <h1 className="max-w-2xl animate-fade-up text-4xl font-bold text-text-dark sm:text-5xl">
            Build flashcard sets and study smarter
          </h1>
          <p className="max-w-xl text-lg text-text-muted">
            Create your own flashcard sets, study with a focused flip mode, and track your progress
            over time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">Get started free</Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="outline">
                Explore public sets
              </Button>
            </Link>
          </div>
        </PageContainer>
      </main>
      <Footer />
    </div>
  );
}
