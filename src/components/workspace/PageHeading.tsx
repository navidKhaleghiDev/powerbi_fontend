import { Card, CardDescription } from "@/components/ui/card";
import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const PageHeading = ({ eyebrow, title, description, actions }: Props) => (
  <Card className="glass-surface gap-0 rounded-2xl border-slate-200 py-0">
  <header className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wider text-teal-700">{eyebrow}</p>
      <h1 className="mt-2 text-xl font-medium tracking-tight text-slate-900">{title}</h1>
      <CardDescription className="mt-2 text-[13px] leading-6 text-slate-600">{description}</CardDescription>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
  </Card>
);
