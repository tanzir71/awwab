export const hadithCollections = {
  bukhari: { en: "Ṣaḥīḥ al-Bukhārī", bn: "সহিহ বুখারি", short: "Bukhari" },
  muslim: { en: "Ṣaḥīḥ Muslim", bn: "সহিহ মুসলিম", short: "Muslim" },
  abudawud: { en: "Sunan Abī Dāwūd", bn: "সুনান আবু দাউদ", short: "Abu Dawud" },
  ibnmajah: { en: "Sunan Ibn Mājah", bn: "সুনান ইবনে মাজাহ", short: "Ibn Majah" },
  nasai: { en: "Sunan an-Nasāʾī", bn: "সুনান আন-নাসায়ি", short: "Nasai" },
  tirmidhi: { en: "Jāmiʿ at-Tirmidhī", bn: "জামি আত-তিরমিজি", short: "Tirmidhi" },
} as const;

export type HadithCollection = keyof typeof hadithCollections;
export const collectionIds = Object.keys(hadithCollections) as HadithCollection[];
export const hadithEditionBase = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

export type HadithGrade = { tier: "sahih" | "hasan"; label: string; grader?: string };
export type HadithNarration = {
  collection: HadithCollection;
  number: string;
  book: number;
  inBook: number;
  text: string;
  arabic?: string;
  grade: HadithGrade;
};
type GradeAnnotation = { name: string; grade: string };
const accepted = /^(?:sahih(?: hadith| - agreed upon| - bukhari and muslim| lighairihi)?|hasan(?: sahih| lighairihi)?)$/i;
const weak = /da.?if|munkar|mawdu|shadh|mursal|batil|maqtu|muquf/i;

export function canonicalHadithNumber(collection: HadithCollection, value: number | string | undefined) {
  const raw = String(value);
  const match = /^([1-9]\d*)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) return undefined;
  if (collection !== "muslim" || match[2] === undefined) return raw;
  const part = Number(match[2]);
  return part >= 1 && part <= 26 ? match[1] + String.fromCharCode(96 + part) : undefined;
}

export function narrationGrade(collection: HadithCollection, book: number, grades: GradeAnnotation[]): HadithGrade | undefined {
  if (grades.some(item => weak.test(item.grade))) return undefined;
  const approved = grades.filter(item => item.name.trim() && accepted.test(item.grade.trim()));
  const found = approved.find(item => /^hasan\b/i.test(item.grade.trim())) ?? approved[0];
  if (found) return {
    tier: /^hasan\b/i.test(found.grade.trim()) ? "hasan" : "sahih", label: found.grade.trim(), grader: found.name.trim(),
  };
  if ((collection === "bukhari" || collection === "muslim") && book > 0 && grades.length === 0) {
    return { tier: "sahih", label: "Sahih" };
  }
  return undefined;
}

export const hadithArchiveVersion = 3;

export function editionUrl(collection: HadithCollection, language: "eng" | "ara" = "eng") {
  return `${hadithEditionBase}/${language}-${collection}.min.json`;
}

export function parseHadithReference(reference: string) {
  const match = /^(.+) ([1-9]\d*)$/u.exec(reference);
  if (!match) return undefined;
  const collection = collectionIds.find(id => hadithCollections[id].short === match[1]);
  return collection && { collection, number: match[2] };
}

export function hadithSource({ collection, number }: Pick<HadithNarration, "collection" | "number">) {
  return number.includes(".") ? editionUrl(collection) : `https://sunnah.com/${collection}:${number}`;
}
