import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type Tone = "success" | "info" | "danger" | "warning" | "neutral";

const tones: Record<Tone, string> = {
  success: "bg-emerald-400 text-ink-950",
  info: "bg-sky-500/90 text-white",
  danger: "bg-rose-500/90 text-white",
  warning: "bg-amber-400 text-ink-950",
  neutral: "border border-ink-600 bg-ink-900/80 text-zinc-300",
};

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const Badge = ({ tone = "neutral", icon, className, children }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
      tones[tone],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);

export default Badge;
