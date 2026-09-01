"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RevealProps {
  children: ReactNode;
  className?: string;
}

const HIDDEN_CLASSES = ["opacity-0", "translate-y-6"];
const VISIBLE_CLASSES = ["opacity-100", "translate-y-0"];

/**
 * Subtle fade/slide-in the first time a section scrolls into view. Renders
 * visible by default (both in the server-rendered HTML and if JS never
 * loads) — the element is only ever switched to hidden by direct DOM
 * manipulation after mount, once an observer has confirmed it can reveal it
 * again, so content is never stuck invisible behind a failed script load.
 * Skips all of this under prefers-reduced-motion. Uses ref-based classList
 * toggling rather than React state so this effect never triggers a render.
 */
export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    node.classList.add(...HIDDEN_CLASSES);
    node.classList.remove(...VISIBLE_CLASSES);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add(...VISIBLE_CLASSES);
          node.classList.remove(...HIDDEN_CLASSES);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("translate-y-0 opacity-100 transition-all duration-700 ease-out", className)}>
      {children}
    </div>
  );
}
