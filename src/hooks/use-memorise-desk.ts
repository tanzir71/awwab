import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { studyQuran, type HifzPlans, type HifzReviews, type StudyQuran } from "@/lib/hifz";
import { db, getRecord } from "@/lib/storageService";
import { memoriseDesk, memorisePlans, type MemoriseDesk } from "@/lib/studyDesk";

const empty: MemoriseDesk = { due: [], forecast: new Map(), attempts: 0, correct: 0 };

export function useMemoriseDesk(enabled: boolean, now: Date, zone: string) {
  const state = useLiveQuery(() => enabled ? db.transaction("r", db.records, () => Promise.all([
    getRecord<HifzPlans>("hifz-plans", {}), getRecord("hifz-current", ""), getRecord<HifzReviews>("hifz-portions", {}),
  ])) : Promise.resolve(undefined), [enabled]);
  const [edition, setEdition] = useState<StudyQuran>();
  const needsEdition = enabled && state && Boolean(state[1] || Object.keys(state[0]).length);
  useEffect(() => {
    if (!needsEdition || edition) return;
    let active = true;
    void studyQuran().then(quran => { if (active) setEdition(quran); }, () => {});
    return () => { active = false; };
  }, [edition, needsEdition]);
  const [plans, current, reviews] = state ?? [];
  const passages = useMemo(() => edition && plans ? memorisePlans(plans, current, edition) : [], [edition, plans, current]);
  return useMemo(() => enabled && reviews ? memoriseDesk(passages, reviews, now, zone) : empty,
    [enabled, passages, reviews, now, zone]);
}
