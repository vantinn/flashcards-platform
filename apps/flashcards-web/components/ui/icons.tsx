import type { SVGProps } from "react";

/**
 * Hand-rolled inline icons matching the stroke style already established by
 * the pronunciation button's speaker icon (24x24 viewBox, no fill, currentColor
 * stroke, width 2, rounded caps/joins) — this project has no icon library
 * dependency, and this keeps every icon visually consistent without adding
 * one. Decorative by default (aria-hidden); when an icon is the only content
 * of a button, the *button* carries the translated aria-label, not the icon.
 */
type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-4 w-4 shrink-0"}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BookOpenIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5c2-1 5-1 8 0v13c-3-1-6-1-8 0v-13Z" />
      <path d="M20 5.5c-2-1-5-1-8 0v13c3-1 6-1 8 0v-13Z" />
    </IconBase>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </IconBase>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5v.3A3 3 0 0 0 4.5 10v1a3 3 0 0 0 1.2 2.4A3 3 0 0 0 6 15v.5A3.5 3.5 0 0 0 9.5 19h0V4.5H9Z" />
      <path d="M15 4.5a2.5 2.5 0 0 1 2.5 2.5v.3a3 3 0 0 1 2 2.7v1a3 3 0 0 1-1.2 2.4A3 3 0 0 1 18 15v.5a3.5 3.5 0 0 1-3.5 3.5h0V4.5H15Z" />
    </IconBase>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11.5 3H5a2 2 0 0 0-2 2v6.5a1 1 0 0 0 .3.7l9.5 9.5a1 1 0 0 0 1.4 0l7.5-7.5a1 1 0 0 0 0-1.4L12.2 3.3a1 1 0 0 0-.7-.3Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </IconBase>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M18 13l-6 6-6-6" />
    </IconBase>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6h3.5c2 0 3 1 4.5 3" />
      <path d="M3 18h3.5c2 0 3-1 4.5-3" />
      <path d="M15 6h6" />
      <path d="M15 18h6" />
      <path d="M17.5 3.5 21 6l-3.5 2.5" />
      <path d="M17.5 20.5 21 18l-3.5-2.5" />
      <path d="M11 12c1.5 2 2.5 3 4 3" />
    </IconBase>
  );
}

export function RotateCcwIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 4v6h6" />
      <path d="M5.5 15a8 8 0 1 0 2-11.3L4 10" />
    </IconBase>
  );
}

export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </IconBase>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </IconBase>
  );
}
