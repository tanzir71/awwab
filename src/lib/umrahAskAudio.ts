import { asset } from "./config";
import { audioCache } from "./audio";
import { hasSharedSpeakAudio } from "./speakAskAudio";
import { askClipPath, askPlaces, askRelations, askVarieties, askVoices, umrahPhrases, type AskPhrase, type AskVariety, type AskVoice } from "./umrahAsk";

type VoiceCredit = { name: string; source: string; bytes: number };
type AudioManifest = {
  version: 1 | 2;
  bytes: number;
  attribution?: string;
  source?: string;
  generated?: boolean;
  voices?: AskVoice[];
  credits?: Partial<Record<AskVoice, VoiceCredit>>;
};
export const askAudioKey = "umrah-ask-audio";
const manifests = import.meta.glob<AudioManifest>("../../docs/content/umrah-phrase-audio.json", { eager: true, import: "default" });
const supplied = Object.values(manifests)[0];
export const askAudioPack = (supplied?.version === 1 || supplied?.version === 2) && Number.isSafeInteger(supplied.bytes) && supplied.bytes > 0
  ? supplied : undefined;
export const packVoices = askAudioPack?.voices ?? askVoices;
export const askVoiceInstalled = (version: number, voice: AskVoice) => Boolean(askAudioPack && packVoices.includes(voice)
  && (version === askAudioPack.version || (version === 1 && voice === "female")));
export const askPlaybackVoice = (version: number, preferred: AskVoice) =>
  askVoiceInstalled(version, preferred) ? preferred : packVoices.includes("female") ? "female" : packVoices[0];

export function askClipIds(phrase: AskPhrase, options: { variety: AskVariety; speaker?: AskVoice | ""; toFemale?: boolean;
  gate?: number; place?: keyof typeof askPlaces; relation?: keyof typeof askRelations }) {
  if (phrase.id === "gate-number") return [phrase.id, `number-${options.gate ?? 79}`];
  if (phrase.id === "bus-to") return [`${phrase.id}-${options.place ?? "madinah"}`];
  if (phrase.id === "lost-family") return [`${phrase.id}-${options.relation ?? "mother"}`];
  if (options.toFemale && phrase.gender?.toFemale?.[options.variety]) return [`${phrase.id}-to-woman`];
  if (options.speaker === "female" && phrase.gender?.speakerFemale?.[options.variety]) return [`${phrase.id}-speaker-female`];
  return [phrase.id];
}

function recordings(variety: AskVariety) {
  return [...new Set([
    ...umrahPhrases.flatMap(phrase => {
      if (phrase.id === "bus-to") return Object.keys(askPlaces).map(place => `bus-to-${place}`);
      if (phrase.id === "lost-family") return Object.keys(askRelations).map(relation => `lost-family-${relation}`);
      return [phrase.id, ...askClipIds(phrase, { variety, speaker: "female" }), ...askClipIds(phrase, { variety, toFemale: true })];
    }),
    ...Array.from({ length: 300 }, (_, index) => `number-${index + 1}`),
  ])];
}

export const askPackPaths = () => askVarieties.flatMap(variety => packVoices.flatMap(voice => recordings(variety).map(id => askClipPath(variety, voice, id))));
const absolute = (path: string) => new URL(asset(path), location.origin).href;

export async function downloadAskAudio(onProgress: (done: number, total: number) => void) {
  if (!askAudioPack) throw new Error("The phrase pack is unavailable");
  const cache = await caches.open(audioCache);
  const urls = askPackPaths().map(absolute);
  let next = 0;
  let done = 0;
  const controller = new AbortController();
  async function take() {
    while (!controller.signal.aborted && next < urls.length) {
      const url = urls[next++];
      if (!(await cache.match(url))) {
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (controller.signal.aborted) return;
        const data = await response.arrayBuffer();
        if (!response.ok || new TextDecoder().decode(data.slice(0, 4)) !== "OggS") throw new Error("A phrase recording could not be read");
        await cache.put(url, new Response(data, { headers: { "Content-Type": "audio/ogg; codecs=opus" } }));
      }
      onProgress(++done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: 6 }, async () => {
    try { await take(); } catch (error) { controller.abort(); throw error; }
  }));
}

export async function playAskAudio(context: AudioContext, ids: string[], variety: AskVariety, voice: AskVoice, slow: boolean) {
  const cache = await caches.open(audioCache);
  const buffers = await Promise.all(ids.map(async id => {
    const url = absolute(askClipPath(variety, voice, id));
    const clip = await cache.match(url) ?? (hasSharedSpeakAudio([id], variety, voice) ? await fetch(url) : undefined);
    if (!clip?.ok) throw new Error("The phrase recording is unavailable offline");
    return context.decodeAudioData(await clip.arrayBuffer());
  }));
  const speed = slow ? .75 : 1;
  if (context.state === "closed") return;
  let when = context.currentTime + .04;
  const overlap = .06;
  await Promise.all(buffers.map((buffer, index) => {
    const node = context.createBufferSource();
    const gain = context.createGain();
    const length = buffer.duration / speed;
    const fade = Math.min(overlap, length / 3);
    node.buffer = buffer;
    node.playbackRate.value = speed;
    node.connect(gain).connect(context.destination);
    if (index) {
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(1, when + fade);
    }
    if (index < buffers.length - 1) {
      gain.gain.setValueAtTime(1, when + length - fade);
      gain.gain.linearRampToValueAtTime(0, when + length);
    }
    const start = when;
    when += length - fade;
    return new Promise<void>(resolve => {
      function done() { context.removeEventListener("statechange", stopped); node.removeEventListener("ended", done); resolve(); }
      function stopped() { if (context.state === "closed") done(); }
      context.addEventListener("statechange", stopped);
      node.addEventListener("ended", done, { once: true });
      node.start(start);
    });
  }));
}
