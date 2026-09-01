import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Build Flashcard Sets and Study Smarter",
  description:
    "Create your own flashcard sets, study with Default Study, Cram Mode, and Deep Learning, track your progress, and discover public sets from other learners.",
  openGraph: {
    title: "Build Flashcard Sets and Study Smarter",
    description:
      "Create your own flashcard sets, study with Default Study, Cram Mode, and Deep Learning, track your progress, and discover public sets from other learners.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-light text-text-dark font-sans">
        {children}
      </body>
    </html>
  );
}
