import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}

const tones = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-teal-200 bg-teal-50 text-teal-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-amber-200 bg-amber-50 text-amber-800",
};

export const StatusBadge = ({ children, tone = "neutral" }: Props) => (
  <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 font-medium ${tones[tone]}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
    {children}
  </Badge>
);
