import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const inputStyles =
  "w-full rounded-card border border-border bg-white px-4 py-2.5 text-sm text-text-dark placeholder:text-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputStyles, className)} {...props} />,
);
Input.displayName = "Input";
