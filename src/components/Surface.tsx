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

export function SectionNav({ title, back }: { title: string; back: string }) {
  const { t } = useCopy();
  return <header className="section-nav">
    <Link to={back} className="icon-button" aria-label={t("back")}><ChevronLeft size={22} /></Link>
    <h1>{title}</h1>
    <span className="w-11" />
  </header>;
}

export function SectionHeading({ title, to, label }: { title: string; to?: string; label?: string }) {
  return <div className="row-between"><h2>{title}</h2>{to && <Link to={to} className="text-button">{label}</Link>}</div>;
}
