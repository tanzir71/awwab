import { useState } from "react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { fluencySentences, matchingReadingWord, wordBankSearch, type RootWord } from "@/lib/fluency";
import { saveFluencyPractice } from "@/lib/studyMilestones";

export function WordFamily({ words }: { words: RootWord[] }) {
  const { t, language } = useCopy();
  return <ul className="word-family">
    {words.map(item => <li key={item.verse ? item.verse + ":" + item.position : item.ar}>
      <div>
        <strong><span lang="en">{item.tr}</span>{item[language] && " · " + item[language]}</strong>
        <small>{t(item.verse ? item.modern ? "wordBankQuranModern" : "wordBankQuran" : "wordBankModern")}{item.verse && " · " + item.verse}</small>
      </div>
      <ArabicText text={item.ar} compact citation={item.verse} verse={item.verse}
        positionOffset={item.position ? item.position - 1 : 0}
        words={[{ transliteration: item.tr, gloss: item.en }]} showGlosses={false} />
    </li>)}
  </ul>;
}

export function ModernReading({ known, zone }: { known: ReadonlySet<string>; zone: string }) {
  const { t, language } = useCopy();
  const read = useRecord<string[]>("fluency-read", []);
  const signs = useRecord<string[]>("fluency-words", []);
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const sentence = fluencySentences[index];
  const practiced = new Set(fluencySentences.filter(item => read.includes(item.id)).flatMap(item => item.ar.split(" ").map(wordBankSearch)));
  const familiar = new Set([...Array.from(known, key => wordBankSearch(key.slice(5))), ...signs.map(wordBankSearch)]);
  const indicators = sentence.ar.split(" ").map(word => matchingReadingWord(word, familiar)
    ? { state: "known" as const, label: t("known") }
    : matchingReadingWord(word, practiced) ? { state: "learning" as const, label: t("wordBankLearning") }
    : { state: "new" as const, label: t("newWord") });

  async function markRead() {
    if (saving || read.includes(sentence.id)) return;
    setSaving(true);
    try {
      await saveFluencyPractice("fluency-read", sentence.id, true, new Date(), zone);
      setReveal(true);
    } catch { toast.error(t("saveError")); }
    finally { setSaving(false); }
  }

  return <section className="card word-modern-reading">
    <header className="row-between">
      <h2>{t("fluencyReadModern")}</h2>
      <button className="text-button" type="button" onClick={() => {
        setIndex(current => (current + 1) % fluencySentences.length);
        setReveal(false);
      }}>{t("wordBankNext")}</button>
    </header>
    <ArabicText text={sentence.ar} indicators={indicators} />
    <p className="small muted">{language === "bn" ? sentence.hintBn : sentence.hintEn}</p>
    {reveal && <div className="word-meaning" role="status">
      <ArabicText text={sentence.vowels} compact />
      <p>{sentence[language]}</p>
    </div>}
    <div className="equal-row">
      <button className="action soft" type="button" aria-expanded={reveal} onClick={() => setReveal(value => !value)}>{t(reveal ? "fluencyHideMeaning" : "fluencyShowMeaning")}</button>
      <button className="action" type="button" disabled={saving || read.includes(sentence.id)} onClick={() => void markRead()}>{t(read.includes(sentence.id) ? "fluencyReadSaved" : "fluencyReadIt")}</button>
    </div>
  </section>;
}
