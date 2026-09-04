import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

/** Same circle-with-image-or-initial pattern as the navbar's account menu, generalized for display-only use (owner info, comment authors). */
export function Avatar({ name, avatarUrl, size = "md", className, ...props }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatarUrl can be an arbitrary external URL (user-supplied on the profile page), so next/image's remote-pattern allowlist doesn't apply here.
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
