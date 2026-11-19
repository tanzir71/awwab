import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { useUi } from "@/lib/uiState";
import { splitArabicWords } from "@/lib/wordAnatomy";
import returnCopy from "../../docs/content/return.json";

const welcome = returnCopy.welcome;
const verseWords = splitArabicWords(welcome.arabic);
const welcomeVerse = "17:25";
const omittedWords = 8;

const sources = [
  ["Tanzil Quran Text", "Uthmani Quran text, © Tanzil Project, CC BY 3.0. The distributed verses are preserved verbatim.", "https://tanzil.net/docs/text_license"],
  ["M. M. Pickthall", "The Meaning of the Glorious Koran. English renderings from Tanzil’s translation archive.", "https://tanzil.net/trans/"],
  ["DigitalKhatt", "IndoPak 15-line Quran text (MIT), IndoPak and Madina fonts (SIL Open Font License). © Amine Anane and Tarteel Inc.", "https://digitalkhatt.org/"],
  ["Quranic Arabic Corpus", "Version 0.4 morphology, © 2011 Kais Dukes, GNU GPL. The original source file is compressed without changes and read locally.", "https://corpus.quran.com/download/"],
  ["Hadith API", "Distributed as public-domain data under the Unlicense. Individual narrations show their specific collection, reference and grade.", "https://github.com/fawazahmed0/hadith-api"],
  ["Adhan JS", "Prayer times are computed on this device with Adhan, MIT.", "https://github.com/batoulapps/adhan-js"],
  ["Fontsource", "Noto Sans, Noto Serif, Noto Sans Arabic, Noto Sans Bengali, Baloo 2 and Nunito are licensed under the SIL Open Font License.", "https://fontsource.org/"],
];

export function Sources() {
  const [search] = useSearchParams();
  const index = Number(search.get("word")) - 1;
  const selected = verseWords[index];
  const selectWord = useUi(state => state.selectWord);
  useEffect(() => {
    if (selected) selectWord({ word: selected, citation: welcome.source, connected: index > 0, verse: welcomeVerse, position: omittedWords + index + 1 });
  }, [index, selected, selectWord]);

  return <div className="stack">
    <SectionNav title="Sources and licences" back="/you" />
    {selected && <section className="card compact-stack">
      <h2>{welcome.source}</h2>
      <ArabicText text={welcome.arabic} citation={welcome.source} verse={welcomeVerse} positionOffset={omittedWords} />
      <p>{welcome.meaning}</p>
      <a className="text-button" href={welcome.url}>Read the full verse</a>
    </section>}
    {sources.map(([name, description, url]) => <section className="card compact-stack" key={name}>
      <h2>{name}</h2><p>{description}</p><a className="text-button" href={url}>Visit {name}</a>
    </section>)}
    <p className="card tint">Awwab is a learning and tracking aid. Ask a qualified scholar about religious rulings for your situation.</p>
  </div>;
}
