import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { asset, IS_PREVIEW } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { formatQuranReference } from "@/lib/quran";
import { useUi } from "@/lib/uiState";
import { splitArabicWords } from "@/lib/wordAnatomy";
import returnCopy from "../../docs/content/return.json";

const welcome = returnCopy.welcome;
const verseWords = splitArabicWords(welcome.arabic);
const welcomeVerse = "17:25";
const omittedWords = 8;

const sources = [
  { name: "Tanzil Quran Text", description: "sourcesTanzil", url: "https://tanzil.net/docs/text_license" },
  { name: "M. M. Pickthall", description: "sourcesPickthall", url: "https://tanzil.net/trans/" },
  { name: "DigitalKhatt", description: "sourcesDigitalKhatt", url: "https://digitalkhatt.org/" },
  { name: "Quranic Arabic Corpus", description: "sourcesCorpus", url: "https://corpus.quran.com/download/" },
  { name: "Hadith API", description: "sourcesHadith", url: "https://github.com/fawazahmed0/hadith-api" },
  { name: "Adhan JS", description: "sourcesAdhan", url: "https://github.com/batoulapps/adhan-js" },
  { name: "OpenStreetMap & Protomaps", description: "sourcesMaps", url: "https://www.openstreetmap.org/copyright" },
  { name: "Fontsource", description: "sourcesFonts", url: asset("app/locale-font-notices.txt"), linkLabel: "sourcesReadFontLicences" },
] as const;

export function Sources() {
  const { t, locale } = useCopy();
  const [search] = useSearchParams();
  const index = Number(search.get("word")) - 1;
  const selected = verseWords[index];
  const selectWord = useUi(state => state.selectWord);
  const citation = t("quranChapterCitation", { name: t("studySurah17"), reference: formatQuranReference(welcomeVerse, locale) });
  useEffect(() => {
    if (selected) selectWord({ word: selected, citation, connected: index > 0, verse: welcomeVerse, position: omittedWords + index + 1 });
  }, [citation, index, selected, selectWord]);

  return <div className="stack">
    <SectionNav title={t("settingsSources")} back="/you" />
    {IS_PREVIEW && <p className="card soft small">{t("previewStatus")}</p>}
    {selected && <section className="card compact-stack">
      <h2><bdi>{citation}</bdi></h2>
      <ArabicText text={welcome.arabic} citation={citation} verse={welcomeVerse} positionOffset={omittedWords} />
      <p>{t("welcomeMeaning")}</p>
      <small className="muted">{t("sourcesExcerptCredit")}</small>
      <a className="text-button" href={welcome.url}>{t("sourcesReadVerse")}</a>
    </section>}
    {sources.map(source => <section className="card compact-stack" key={source.name}>
      <h2><bdi lang="en">{source.name}</bdi></h2>
      <p>{t(source.description)}</p>
      <a className="text-button" href={source.url}>
        {"linkLabel" in source ? t(source.linkLabel) : t("sourcesVisit", { name: source.name })}
      </a>
    </section>)}
    <p className="card tint">{t("sourcesStudyAid")}</p>
  </div>;
}
