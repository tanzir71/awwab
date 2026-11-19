import { useEffect, useState } from "react";
import { curatedHadithFor, hadithId, loadHadith, parseHadithId, riyadSelections, type CollectionScope } from "@/lib/hadith";
import { collectionIds, type HadithCollection, type HadithNarration } from "@/lib/hadith-catalogue";

export function useHadithEditions(scope: CollectionScope, enabled: boolean) {
  const [data, setData] = useState<{ scope: CollectionScope; items: HadithNarration[]; missing: number }>();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const requested: HadithCollection[] = scope === "all" ? collectionIds : [scope === "riyadussalihin" ? "muslim" : scope];
    void Promise.allSettled(requested.map(loadHadith)).then(loaded => {
      if (current) setData({ scope,
        items: loaded.flatMap(item => item.status === "fulfilled" ? item.value : []),
        missing: loaded.filter(item => item.status === "rejected").length,
      });
    });
    return () => { current = false; };
  }, [scope, enabled]);
  return enabled && data?.scope === scope ? data : undefined;
}

export function useHadithNarration(id: string) {
  const related = riyadSelections.find(item => hadithId("riyadussalihin", item.number) === id);
  const actual = related?.original ?? id;
  const ref = parseHadithId(actual);
  const collection = ref?.collection;
  const number = ref?.number;
  const seed = curatedHadithFor(actual);
  const [loaded, setLoaded] = useState<{ id: string; status: "missing" | "unavailable" | "ready"; narration?: HadithNarration }>();

  useEffect(() => {
    if (!collection) return;
    let current = true;
    void loadHadith(collection).then(items => {
      if (!current) return;
      const narration = items.find(item => item.number === number);
      setLoaded({ id: actual, status: narration ? "ready" : "missing", narration });
    }, () => { if (current) setLoaded({ id: actual, status: "unavailable" }); });
    return () => { current = false; };
  }, [actual, collection, number]);

  const result = loaded?.id === actual ? loaded : undefined;
  return { actual, ref, seed, related, narration: result?.narration, status: result?.status ?? (collection ? "loading" : "missing") };
}
