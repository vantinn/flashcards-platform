import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-8", className)} {...props} />;
}
