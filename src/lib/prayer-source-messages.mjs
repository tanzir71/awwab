import returning from "../../docs/content/return.json" with { type: "json" };
import prayer from "../../docs/content/prayer-guide.json" with { type: "json" };

export const sayyidMeaningKey = index => `sayyidMeaning-${index + 1}`;

const returnFile = "docs/content/return.json";
const reading = (en, bn, file) => ({ en, bn, definition: { file } });

export const prayerSourceMessages = {
  returnHopeMeaning: reading(returning.hope.meaning, returning.hope.meaningBn, returnFile),
  guideHanafiSahwDetail: reading(prayer.hanafiSahw.en, prayer.hanafiSahw.bn, "docs/content/prayer-guide.json"),
  ...Object.fromEntries(returning.sayyid.lines.map(([, en], index) =>
    [sayyidMeaningKey(index), reading(en, returning.sayyid.meaningsBn[index], returnFile)])),
};
