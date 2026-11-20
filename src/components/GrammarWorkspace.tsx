import { useState, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link } from "react-router-dom";
import { useDesktop } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { focusListItem } from "@/lib/focusListItem";
import { grammarLessonKey } from "@/lib/grammar-lesson-messages.mjs";
import type { Reviews } from "@/lib/reviews";

export function GrammarLessonList({ lessons, course, path, prefix, reviews, current }: {
  lessons: readonly { id: string }[]; course: string; path: string; prefix: string; reviews?: Reviews; current?: string;
}) {
  const { t } = useCopy();
  return <ol className="compact-stack grammar-index" onKeyDown={focusListItem}>
    {lessons.map(unit => {
      const label = <><strong>{t(grammarLessonKey(course, unit.id, "title"))}</strong>
        {(reviews?.[prefix + unit.id]?.correct ?? 0) > 0 && <span aria-label={t("pathsDone")}>✓</span>}</>;
      return <li key={unit.id}>{unit.id === current
        ? <div className="row-between grammar-current" aria-current="page">{label}</div>
        : <Link className="row-between" to={`${path}/${unit.id}`}>{label}</Link>}
      </li>;
    })}
  </ol>;
}

export function GrammarWorkspace({ title, directory, children, showDirectoryOnMobile = false }: {
  title: string; directory: ReactNode; children: ReactNode; showDirectoryOnMobile?: boolean;
}) {
  const { t, direction } = useCopy();
  const desktop = useDesktop();
  const wide = useDesktop(1280);
  const [tab, setTab] = useState("study");

  if (!desktop) return <>{children}{showDirectoryOnMobile && directory}</>;
  if (wide) return <div className="grammar-workspace">{directory}{children}</div>;

  return <Tabs.Root className="workspace-tabs" dir={direction} value={tab} onValueChange={setTab}>
    <Tabs.List className="study-tabs equal-row" aria-label={title}>
      <Tabs.Trigger value="study">{t("grammarStudy")}</Tabs.Trigger>
      <Tabs.Trigger value="lessons">{t("grammarLessons")}</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content className="grammar-study-tab" value="study" forceMount>{children}</Tabs.Content>
    <Tabs.Content className="grammar-lessons-tab" value="lessons">{directory}</Tabs.Content>
  </Tabs.Root>;
}
