import { IntlMessageFormat } from "intl-messageformat";
import type { Settings } from "./storageService";

const messages: Record<string, { en: string | [string, string]; bn: string | [string, string] }> = {
  today: { en: "Today", bn: "আজ" },
  learn: { en: "Learn", bn: "শিখি" },
  return: { en: "Return", bn: "ফিরে আসি" },
  plan: { en: "Plan", bn: "পরিকল্পনা" },
  you: { en: "You", bn: "আপনি" },
  prayers: { en: "Prayers", bn: "সালাত" },
  studyPlan: { en: ["Study plan", "Let’s learn today"], bn: ["পড়ার পরিকল্পনা", "আজ শিখি"] },
  greeting: { en: ["Assalamu alaikum", "Assalamu alaikum!"], bn: ["আসসালামু আলাইকুম", "আসসালামু আলাইকুম!"] },
  todayPrayers: { en: "Today’s prayers", bn: "আজকের সালাত" },
  todayPractice: { en: ["Your 5 minutes today", "Today’s mission"], bn: ["আজকের পাঁচ মিনিট", "আজকের কাজ"] },
  comingUp: { en: "Coming up", bn: "সামনে যা আসছে" },
  welcomeReturn: { en: ["Welcome back.", "Say sorry to Allah"], bn: ["আবার স্বাগতম।", "আল্লাহর কাছে ক্ষমা চাই"] },
  iPrayed: { en: "I’ve prayed {name}", bn: "{name} পড়েছি" },
  activity: { en: "{count, plural, one {# study day} other {# study days}}", bn: "{count, number} দিন পড়েছি" },
  noStorage: { en: "Device storage is unavailable", bn: "ডিভাইসের সংরক্ষণাগার ব্যবহার করা যাচ্ছে না" },
  opening: { en: "Opening awwab…", bn: "আওয়াব খুলছে…" },
  qaida: { en: "Qaida", bn: "কায়দা" },
  surahs: { en: "Surahs", bn: "সূরা" },
  wordBank: { en: "Word bank", bn: "শব্দভান্ডার" },
  takhti: { en: "Takhti", bn: "তখতি" },
  fluency: { en: "Fluency", bn: "আরবি পাঠ" },
  hadith: { en: "Hadith", bn: "হাদিস" },
  mosques: { en: "My mosques", bn: "আমার মসজিদ" },
  zakat: { en: "Zakat", bn: "যাকাত" },
  umrah: { en: "Umrah mode", bn: "উমরাহ মোড" },
  print: { en: "Print & export", bn: "প্রিন্ট ও এক্সপোর্ট" },
};

const navMessages: Record<string, string> = {
  Today: "today", Learn: "learn", Return: "return", Plan: "plan", You: "you", Prayers: "prayers", "Study plan": "studyPlan",
  Qaida: "qaida", Surahs: "surahs", "Word bank": "wordBank", Takhti: "takhti", Fluency: "fluency", Hadith: "hadith",
  "My mosques": "mosques", Zakat: "zakat", "Umrah mode": "umrah", "Print & export": "print",
};

const formats = new Map<string, IntlMessageFormat<Record<string, string | number>>>();
export function message(settings: Pick<Settings, "mode" | "language">, id: string, values?: Record<string, string | number>) {
  const draft = messages[id]?.[settings.language] ?? id;
  const format = typeof draft === "string" ? draft : draft[settings.mode === "maktab" ? 1 : 0];
  const key = settings.language + ":" + format;
  if (!formats.has(key)) formats.set(key, new IntlMessageFormat<Record<string, string | number>>(format, settings.language));
  return formats.get(key).format(values) as string;
}

export function navigationLabel(settings: Settings, title: string) {
  return message(settings, navMessages[title] ?? title);
}
