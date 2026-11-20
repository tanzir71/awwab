import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCopy } from "@/lib/copy";

export function ListLink({ to, icon, title, detail }: {
  to: string; icon: ReactNode; title: string; detail?: string;
}) {
  return <Link to={to} className="list-row">
    <span className="icon-box" aria-hidden="true">{icon}</span>
    <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
    <ChevronRight size={18} aria-hidden="true" />
  </Link>;
}

export function SectionNav({ title, back, backIcon, action }: { title: string; back: string; backIcon?: ReactNode; action?: ReactNode }) {
  const { t } = useCopy();
  return <header className="section-nav">
    <Link to={back} className="icon-button" aria-label={t("back")}>{backIcon ?? <ChevronLeft size={22} className="icon-dir" />}</Link>
    <h1>{title}</h1>
    {action ?? <span className="w-11" />}
  </header>;
}

export function SectionHeading({ title, to, label, arrow = false }: { title: string; to?: string; label?: string; arrow?: boolean }) {
  return <div className="row-between"><h2>{title}</h2>{to && <Link to={to} className="text-button">
    {label}{arrow && <span className="ms-1 inline-block icon-dir" aria-hidden="true">→</span>}
  </Link>}</div>;
}
