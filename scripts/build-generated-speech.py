"""Build offline speech clips with local models and FFmpeg."""

import argparse
from array import array
from hashlib import sha256
import io
import json
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
import wave

ROOT = Path(__file__).resolve().parent.parent
PHRASES = ROOT / "handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json"
CONTENT = ROOT / "docs/content"
OUTPUT = ROOT / "public/packs"
MODEL = "https://huggingface.co/vadimbelsky/arabic-emirati-female-piper/tree/cfe173969620e40be65b5dd8ed4d97d55a864325"
A3S = "https://huggingface.co/MahmoudIbrahim/A3S/tree/b6eb8229a94feb68887cb0ba926292921216cbd5"
SPEAK_COURSES = ("saudi-a2", "saudi-b1", "gulf-a1", "umrah-hajj", "gulf-work")
LJSPEECH = "https://huggingface.co/rhasspy/piper-voices/blob/b145f2ac26522d6a2ccde0164b7b0e48b1e3199c/en/en_US/ljspeech/medium/MODEL_CARD"
INDIC_BENGALI = "https://huggingface.co/sulabhkatiyar/indic-tiny-tts-bengali/tree/a6bb92894272219d8d2bbd03cb1121a6be3164a8"
LIBRA_URDU = "https://huggingface.co/Ekam/Libra-TTS/tree/f8f945e21862cb4a9cf7c8408acffecd9d78c9b4"
RASA = "https://huggingface.co/datasets/ai4bharat/Rasa"
SIWIS = "https://huggingface.co/rhasspy/piper-voices/blob/0c9c5d340496a47205a799eb046aab69334a88e9/fr/fr_FR/siwis/medium/MODEL_CARD"
SIWIS_DATA = "https://doi.org/10.7488/ds/1705"
SUARIFY_YATI = "https://huggingface.co/Suarify/kecil-tts-yati-v0.3/tree/dcb1efaaaccdfc53b4b0cdbfad190e86ddeac68b"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def phrase_clips(phrases, variety):
    for phrase in phrases:
        slug = phrase["id"]
        line = phrase[variety]["ar"]
        if slug == "bus-to":
            for place, name in {"madinah": "المدينة", "jeddah": "جدة", "airport": "المطار", "hotel": "الفندق"}.items():
                yield f"{slug}-{place}", line.replace("{place}", name)
        elif slug == "lost-family":
            for relation, name in {"mother": "أمي", "father": "أبوي", "son": "ولدي", "daughter": "بنتي", "wife": "زوجتي", "husband": "زوجي"}.items():
                gendered = line.replace("ضاع", "ضاعت") if variety == "saudi" and relation in ("mother", "daughter", "wife") else line
                yield f"{slug}-{relation}", gendered.replace("{relation}", name)
        else:
            yield slug, line.replace("{n}", "").rstrip(" ؟?") if slug == "gate-number" else line
            for suffix, key in [("speaker-female", "speakerFemale"), ("to-woman", "toFemale")]:
                alternative = phrase.get("gender", {}).get(key, {}).get(variety)
                if alternative:
                    yield f"{slug}-{suffix}", alternative[0]
    for number in range(1, 301):
        yield f"number-{number}", str(number)


def encode(synthesize_wav, path, text):
    wav = io.BytesIO()
    with wave.open(wav, "wb") as stream:
        synthesize_wav(text, stream)
    encode_wav(wav.getvalue(), path)


def encode_wav(wav, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    codec, bitrate, container = ("libmp3lame", "48k", "mp3") if path.suffix == ".mp3" else ("libopus", "32k", "ogg")
    filters = "loudnorm=I=-16:TP=-1:LRA=7,adelay=150,apad=pad_dur=0.15"
    if container == "mp3":
        filters += ",asetpts=N/SR/TB"
    result = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", "pipe:0", "-af", filters, "-ac", "1", "-ar", "48000",
         "-c:a", codec, "-b:a", bitrate, "-f", container, "pipe:1"],
        input=wav, stdout=subprocess.PIPE, check=True,
    )
    if len(result.stdout) <= 500:
        raise ValueError(f"Empty clip for {path.name}")
    temporary = path.with_suffix(path.suffix + ".part")
    temporary.write_bytes(result.stdout)
    temporary.replace(path)


def write_umrah_guide_packs(packs):
    manifest = CONTENT / "umrah-guide-audio.json"
    previous = read(manifest)["packs"] if manifest.exists() else []
    by_language = {pack["language"]: pack for pack in (*previous, *packs)}
    write(manifest, {"packs": list(by_language.values())})


def umrah_guide_pack(language, name, speaker, source, license_url, synthesize):
    pack_id = f"umrah-guide-v1-{language}"
    files = []
    for step in read(CONTENT / "umrah-steps.json")["steps"]:
        ref = f"{pack_id}:{step['id']}"
        relative = f"packs/audio/umrah-guide-v1/{language}/{step['id']}.mp3"
        with TemporaryDirectory() as directory:
            target = Path(directory) / "clip.wav"
            synthesize(step["narration"][language], target)
            encode_wav(target.read_bytes(), ROOT / "public" / relative)
        files.append({"ref": ref, "path": relative})
        print(ref, flush=True)
    return {
        "id": pack_id, "language": language, "name": name, "speaker": speaker, "source": source,
        "licenseUrl": license_url, "attribution": f"Generated speech · {speaker}",
        "bytes": sum((ROOT / "public" / item["path"]).stat().st_size for item in files), "items": files,
    }


def build_umrah_guide(model, piper, bangla_model):
    sys.path.insert(0, str(bangla_model.resolve()))
    from indic_tiny_tts import TinyTTSOnnx

    bangla = TinyTTSOnnx(bangla_model, threads=2)

    def english(text, target):
        pronounced = text.replace("miqat", "mee-kaht").replace("Sa'y", "saa-ee")
        subprocess.run([piper, "--model", str(model), "--output_file", str(target)],
                       input=pronounced.encode("utf-8"), check=True)

    def bengali(text, target):
        bangla.tts_to_file(text, target, voice="female", speed=0.95, seed=0)

    en = umrah_guide_pack("en", "English", "Piper LJSpeech", LJSPEECH,
                          "https://keithito.com/LJ-Speech-Dataset/", english)
    bn = umrah_guide_pack("bn", "বাংলা", "Indic Tiny TTS Bengali", INDIC_BENGALI,
                          "https://creativecommons.org/licenses/by/4.0/", bengali)
    bn["dataset"] = RASA
    bn["datasetName"] = "AI4Bharat Rasa"
    write_umrah_guide_packs([en, bn])


def build_umrah_guide_urdu(model):
    from libra_tts import LibraTTS

    voice = LibraTTS(model=str(model.resolve()), backend="cuda", compile=False)

    def urdu(text, target):
        speech = voice.synthesize(text, voice="aliya", lang="ur", style="calm", pace="slow", seed=0)
        voice.save(str(target), speech)

    pack = umrah_guide_pack("ur", "اردو", "Libra TTS · Aliya", LIBRA_URDU,
                            "https://www.apache.org/licenses/LICENSE-2.0", urdu)
    write_umrah_guide_packs([pack])


def build_umrah_guide_french(model):
    from piper import PiperVoice

    voice = PiperVoice.load(model)
    pronunciation = {
        "Iḥrām": "Ihrame", "mīqāt": "mi-kâte", "Ṭawāf": "Taouaf", "Kaʿba": "Kaaba",
        "rakʿāt": "rakaates", "Maqām Ibrāhīm": "Maqam Ibrahim", "Saʿy": "Saï", "saʿy": "saï",
        "Ṣafā": "Safa", "Marwa": "Maroua",
    }

    def french(text, target):
        for written, spoken in pronunciation.items():
            text = text.replace(written, spoken)
        with wave.open(str(target), "wb") as stream:
            voice.synthesize_wav(text, stream)

    pack = umrah_guide_pack("fr", "Français", "Piper · SIWIS", SIWIS,
                            "https://creativecommons.org/licenses/by/4.0/", french)
    pack["dataset"] = SIWIS_DATA
    pack["datasetName"] = "SIWIS French Speech Synthesis Database"
    write_umrah_guide_packs([pack])


def build_umrah_guide_malay(model):
    from kecil_tts import KecilTTS, SAMPLE_RATE
    import soundfile as sf

    voice = KecilTTS(str(model.resolve()))

    def malay(text, target):
        sf.write(target, voice(text, speed=0.95), SAMPLE_RATE, subtype="PCM_16")

    pack = umrah_guide_pack("ms", "Bahasa Melayu", "Kecil-TTS Yati · Suarify", SUARIFY_YATI,
                            "https://www.apache.org/licenses/LICENSE-2.0", malay)
    write_umrah_guide_packs([pack])


def course_clips(units):
    for unit in units:
        slug = unit["id"]
        for number, line in enumerate(unit["dialogue"], start=1):
            if isinstance(line, list):
                yield f"{slug}-line-{number}", line[0]
        for number, word in enumerate(unit["words"], start=1):
            yield f"{slug}-word-{number}", word["ar"]
        yield f"sign-{slug}", unit.get("signSpeech", unit["sign"])


# Piper's Arabic text frontend spells out isolated letters, even with vowel marks.
# These Qaida drills model the spoken letter names or syllables directly.
QAIDA_LETTERS = {
    "ا": ("ʔ", "ʔalif"), "ب": ("b", "baːʔ"), "ت": ("t", "taːʔ"), "ث": ("θ", "θaːʔ"),
    "ج": ("dʒ", "dʒiːm"), "ح": ("ħ", "ħaːʔ"), "خ": ("x", "xaːʔ"), "د": ("d", "daːl"),
    "ذ": ("ð", "ðaːl"), "ر": ("r", "raːʔ"), "ز": ("z", "zaːj"), "س": ("s", "siːn"),
    "ش": ("ʃ", "ʃiːn"), "ص": ("sˤ", "sˤaːd"), "ض": ("dˤ", "dˤaːd"), "ط": ("tˤ", "tˤaːʔ"),
    "ظ": ("ðˤ", "ðˤaːʔ"), "ع": ("ʕ", "ʕajn"), "غ": ("ɣ", "ɣajn"), "ف": ("f", "faːʔ"),
    "ق": ("q", "qaːf"), "ك": ("k", "kaːf"), "ل": ("l", "laːm"), "م": ("m", "miːm"),
    "ن": ("n", "nuːn"), "ه": ("h", "haːʔ"), "و": ("w", "waːw"), "ي": ("j", "jaːʔ"),
}
QAIDA_MARKS = {"َ": "a", "ِ": "i", "ُ": "u", "ً": "an", "ٍ": "in", "ٌ": "un"}
QAIDA_WORDS = {
    "بَاب": "baːb", "جَبَل": "dʒabal", "قُلْ": "qul", "كَتَبَ": "kataba", "نَصَرَ": "nasˤara", "رَبِّ": "rabbi",
    "بَابٌ": "baːbun", "قَلَمٌ": "qalamun", "كِتَابٌ": "kitaːbun",
    "بَابًا": "baːban", "قَلَمٍ": "qalamin", "كِتَابٍ": "kitaːbin",
    "بَا": "baː", "بِي": "biː", "بُو": "buː", "بَيْ": "baj", "بَوْ": "baw",
    "بِسْمِ": "bismi", "أَحَدٌ": "ʔaħadun", "يَوْمٌ": "jawmun", "ٱلْعَصْرِ": "ʔalʕasˤri",
    "هَٰذَا": "haːðaː", "مَٰلِكِ": "maːliki", "ٱلرَّحْمَٰنِ": "ʔarːaħmaːni", "مُوسَىٰ": "muːsaː",
    "خَيْرٌ": "xajrun", "سَلَامٌ": "salaːmun", "نُورٌ": "nuːrun", "رَيْبٌ": "rajbun",
    "أَبْ": "ʔab", "أَجْ": "ʔadʒ", "أَدْ": "ʔad", "بِسْ": "bis",
    "ٱلْحَمْدُ": "ʔalħamdu", "نَعْبُدُ": "naʕbudu", "ٱهْدِنَا": "ʔihdinaː",
    "رَبَّ": "rabːa", "إِنَّ": "ʔinːa", "أُمُّ": "ʔumːu", "حَقٌّ": "ħaqːun",
    "ٱلضُّحَىٰ": "ʔadˤːuħaː", "ٱلنَّاسِ": "ʔanːaːsi", "ٱلصَّمَدُ": "ʔasˤːamadu",
    "مِنْ": "min",
}
QAIDA_DRILL_LESSONS = tuple(range(1, 14))


def qaida_phonemes(text, lesson):
    if lesson <= 3:
        return [QAIDA_LETTERS[letter][1] for letter in text if letter != "ٓ"]
    if text in QAIDA_WORDS:
        return [QAIDA_WORDS[text]]
    letter, mark = text
    return [QAIDA_LETTERS[letter][0] + QAIDA_MARKS[mark]]


def build_qaida_placement(render, resume=False):
    for slug, text in (("bi", "بِ"), ("bu", "بُ")):
        path = OUTPUT / "study-speech" / f"{slug}.opus"
        if not resume or not path.is_file():
            render(qaida_phonemes(text, 4), path)


def qaida_renderer(voice):
    from functools import cache
    import numpy as np
    from piper.config import SynthesisConfig

    rate = voice.config.sample_rate
    gap = bytes(round(rate * 0.18) * 2)
    config = SynthesisConfig(noise_scale=0, noise_w_scale=0)

    @cache
    def phoneme_pcm(phonemes):
        if unsupported := set(phonemes) - voice.config.phoneme_id_map.keys():
            raise ValueError(f"The voice cannot generate phonemes {unsupported}")
        audio = voice.phoneme_ids_to_audio(voice.phonemes_to_ids(list(phonemes)), config)
        peak = np.max(np.abs(audio))
        if peak < 0.005:
            raise ValueError(f"Piper produced no speech for {phonemes}")
        return (audio * (29490 / peak)).astype("<i2").tobytes()

    def render(phonemes, path):
        wav = io.BytesIO()
        with wave.open(wav, "wb") as stream:
            stream.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            stream.writeframes(gap.join(phoneme_pcm(part) if part else gap for part in phonemes))
        encode_wav(wav.getvalue(), path)

    return render


def build_qaida(voice, resume):
    # Both the visible exercises and the generated clips use the same row data and saved recording keys.
    query = """
        import { qaidaAudioRef, qaidaHarakatExercise, qaidaHarakatExerciseRef, qaidaRows } from './src/lib/qaidaPractice.ts';
        const drills = process.argv.slice(1).map(Number).map(lesson => ({
            lesson, ref: qaidaAudioRef(lesson),
            rows: qaidaRows(lesson).map((row, index) => ({ ref: qaidaAudioRef(lesson, index), text: row.flat() })),
        }));
        console.log(JSON.stringify({
            drills, intro: { ref: qaidaHarakatExerciseRef, text: qaidaHarakatExercise.split(" ") },
            isolatedNun: { ref: qaidaAudioRef(16, 0), text: qaidaRows(16)[0][0][0] },
        }));
    """
    data = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", query, *map(str, QAIDA_DRILL_LESSONS)], cwd=ROOT, encoding="utf-8",
    ))
    render = qaida_renderer(voice)
    items = {}

    def clip(ref, ipa):
        relative = f"packs/study-speech/{ref.replace(':', '-')}.opus"
        path = ROOT / "public" / relative
        if not resume or not path.is_file() or path.stat().st_size < 1000:
            render(ipa, path)
        items[ref] = relative

    for drill in data["drills"]:
        lesson = drill["lesson"]
        full = []
        for row in drill["rows"]:
            phonemes = [part for text in row["text"] for part in qaida_phonemes(text, lesson)]
            clip(row["ref"], phonemes)
            full.extend(phonemes + [""])
        clip(drill["ref"], full[:-1])
        print(f"Encoded {len(drill['rows'])} rows and a full exercise for lesson {lesson}", flush=True)
    intro = data["intro"]
    clip(intro["ref"], [part for text in intro["text"] for part in qaida_phonemes(text, 4)])
    isolated_nun = data["isolatedNun"]
    clip(isolated_nun["ref"], qaida_phonemes(isolated_nun["text"], 16))
    build_qaida_placement(render, resume)
    write(CONTENT / "qaida-audio.json", {"voice": "Emirati Piper", "source": MODEL, "lessons": QAIDA_DRILL_LESSONS, "items": items})


def nabra_synthesizer(model_dir):
    import sherpa_onnx

    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=str(model_dir / "model.int8.onnx"),
                voices=str(model_dir / "voices.bin"),
                tokens=str(model_dir / "tokens.txt"),
                data_dir=str(model_dir / "espeak-ng-data"),
                lang="ar",
            ),
            num_threads=4,
        )
    )
    if not config.validate():
        raise ValueError("Pass the extracted nabra-82m-arabic-int8 directory.")
    tts = sherpa_onnx.OfflineTts(config)

    def synthesize(text, stream):
        stream.setparams((1, 2, tts.sample_rate, 0, "NONE", "not compressed"))
        audio = tts.generate(text, sid=0, speed=1.0)
        if not audio.samples:
            raise ValueError(f"Nabra produced no speech for {text}")
        pcm = array("h", (round(32767 * max(-1.0, min(1.0, sample))) for sample in audio.samples))
        stream.writeframes(pcm.tobytes())

    return synthesize


def gate_number_words(number):
    ones = ("", "وَاحِد", "اِثْنَان", "ثَلَاثَة", "أَرْبَعَة", "خَمْسَة", "سِتَّة", "سَبْعَة", "ثَمَانِيَة", "تِسْعَة")
    tens = ("", "عَشَرَة", "عِشْرُون", "ثَلَاثُون", "أَرْبَعُون", "خَمْسُون", "سِتُّون", "سَبْعُون", "ثَمَانُون", "تِسْعُون")
    hundreds = ("", "مِئَة", "مِئَتَان", "ثَلَاثُمِئَة")
    hundred, remainder = divmod(number, 100)
    ten, one = divmod(remainder, 10)
    if 11 <= remainder <= 19:
        unit = {1: "أَحَدَ", 2: "اِثْنَا"}.get(one, ones[one])
        rest = f"{unit} عَشَر"
    else:
        rest = " وَ".join(part for part in (ones[one], tens[ten]) if part)
    return " وَ".join(part for part in (hundreds[hundred], rest) if part)


def ask_clip_path(variety, voice, slug):
    return OUTPUT / "phrases" / variety / voice / f"{slug}.opus"


def write_ask_manifest(phrases):
    voices = {}
    checksums = {}
    for voice, name, source in (("female", "Emirati Piper", MODEL), ("male", "A3S", A3S)):
        clips = [ask_clip_path(variety, voice, slug)
                 for variety in ("saudi", "msa") for slug, _ in phrase_clips(phrases, variety)]
        if all(path.is_file() for path in clips):
            size = 0
            for path in clips:
                data = path.read_bytes()
                if not data.startswith(b"OggS") or b"OpusHead" not in data[:95]:
                    raise ValueError(f"Invalid Opus clip: {path}")
                checksums[path.relative_to(ROOT / "public").as_posix()] = sha256(data).hexdigest()
                size += len(data)
            voices[voice] = {"name": name, "source": source, "bytes": size}
    if "female" not in voices:
        raise ValueError("Build the female Ask recordings before making the shared manifest.")
    index = (json.dumps(checksums, indent=2, sort_keys=True) + "\n").encode("utf-8")
    (OUTPUT / "phrases" / "checksums.json").write_bytes(index)
    write(CONTENT / "umrah-phrase-audio.json", {
        "version": len(voices),
        "bytes": sum(voice["bytes"] for voice in voices.values()),
        "generated": True,
        "voices": list(voices),
        "credits": voices,
        "checksumsSha256": sha256(index).hexdigest(),
    })


def build_male_ask(model_dir, phrases, resume):
    import numpy as np
    import soundfile
    import torch
    from qwen_tts import Qwen3TTSModel

    torch.manual_seed(71)
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    model = Qwen3TTSModel.from_pretrained(
        str(model_dir), device_map=device, dtype=torch.bfloat16 if device != "cpu" else torch.float32,
        attn_implementation="sdpa", local_files_only=True,
    )
    def valid(samples):
        return len(samples) and np.isfinite(samples).all() and np.max(np.abs(samples)) >= .02

    batch_size = 12
    for variety, speaker, language in (("saudi", "fahad", "arabic-sa"), ("msa", "omar", "auto")):
        clips = []
        for slug, text in phrase_clips(phrases, variety):
            path = ask_clip_path(variety, "male", slug)
            if resume and path.is_file() and path.stat().st_size > 500:
                continue
            if slug.startswith("number-"):
                vocalized = gate_number_words(int(text))
                bare = re.sub(r"[\u064b-\u065f]", "", vocalized)
                candidates = (f"{bare}.", bare, vocalized)
            elif slug == "gate-number" and variety == "saudi":
                candidates = ("فِين بَاب رَقْم", text)
            else:
                candidates = (text, text.rstrip("؟?!.,،") + ".", text)
            clips.append((path, candidates))
        options = {"speaker": speaker, "language": language, "temperature": .65,
                   "subtalker_temperature": .4, "max_new_tokens": 100}
        for start in range(0, len(clips), batch_size):
            batch = clips[start:start + batch_size]
            audio, rate = model.generate_custom_voice(text=[candidates[0] for _, candidates in batch], **options)
            for (path, candidates), samples in zip(batch, audio, strict=True):
                for alternate in candidates[1:]:
                    if valid(samples):
                        break
                    retry, rate = model.generate_custom_voice(text=alternate, **options)
                    samples = retry[0]
                if not valid(samples):
                    raise ValueError(f"A3S produced empty speech for {variety}/{path.name}")
                wav = io.BytesIO()
                soundfile.write(wav, samples, rate, format="WAV", subtype="PCM_16")
                encode_wav(wav.getvalue(), path)
            print(f"Encoded {start + len(batch)}/{len(clips)} {variety} male clips", flush=True)
    write_ask_manifest(phrases)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, nargs="?", help="Local weights for the selected speech model")
    task = parser.add_mutually_exclusive_group()
    task.add_argument("--course", choices=(*SPEAK_COURSES, "msa-a1"), help="Only rebuild the selected Speak course")
    task.add_argument("--ask-male", action="store_true", help="Build the second Ask voice using A3S")
    task.add_argument("--ask-manifest", action="store_true", help="Index the existing Ask recordings without rebuilding speech")
    task.add_argument("--umrah-guide", action="store_true", help="Build English and Bangla Umrah narration with Piper LJSpeech and Indic Tiny TTS")
    task.add_argument("--umrah-guide-urdu", action="store_true", help="Build Urdu Umrah narration with local Libra TTS weights")
    task.add_argument("--umrah-guide-french", action="store_true", help="Build French Umrah narration with local Piper SIWIS weights")
    task.add_argument("--umrah-guide-malay", action="store_true", help="Build Malay Umrah narration with local Kecil-TTS Yati weights")
    task.add_argument("--qaida", action="store_true", help="Build Qaida drill audio and placement vowel clips with Emirati Piper")
    parser.add_argument("--piper", default="piper", help="Piper executable for --umrah-guide")
    parser.add_argument("--bangla-model", type=Path, help="Local Indic Tiny TTS Bengali model directory with code and ONNX graphs")
    parser.add_argument("--resume", action="store_true", help="Reuse completed clips when extending a Qaida or A3S build")
    args = parser.parse_args()
    if args.ask_manifest:
        write_ask_manifest(read(PHRASES)["phrases"])
        return
    if args.model is None:
        parser.error("a model is required to generate speech")
    if args.umrah_guide:
        if args.bangla_model is None:
            parser.error("--umrah-guide requires --bangla-model")
        build_umrah_guide(args.model, args.piper, args.bangla_model)
        return
    if args.umrah_guide_urdu:
        build_umrah_guide_urdu(args.model)
        return
    if args.umrah_guide_french:
        build_umrah_guide_french(args.model)
        return
    if args.umrah_guide_malay:
        build_umrah_guide_malay(args.model)
        return
    if args.ask_male:
        build_male_ask(args.model, read(PHRASES)["phrases"], args.resume)
        return
    if args.course == "msa-a1":
        synthesize_wav = nabra_synthesizer(args.model)
        for slug, line in course_clips(read(CONTENT / "spoken-msa-a1.json")):
            encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)
        return

    from piper import PiperVoice

    voice = PiperVoice.load(args.model)
    if args.qaida:
        build_qaida(voice, args.resume)
        return
    synthesize_wav = voice.synthesize_wav
    for course in (args.course,) if args.course else SPEAK_COURSES:
        for slug, line in course_clips(read(CONTENT / f"spoken-{course}.json")):
            encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)
    if args.course:
        return

    units = read(CONTENT / "spoken-arabic.json")
    prompts = {"ghayn": "غَيْن", "mim": "مِيم"}
    build_qaida_placement(qaida_renderer(voice))
    prompts.update({f"sim-{i}": line["ar"] for i, line in enumerate(units["simDialogue"], start=1)})
    prompts.update({f"sim-word-{i}": line["ar"] for i, line in enumerate(units["simWords"], start=1)})
    prompts.update({f"sign-{unit['id']}": unit["sign"] for unit in units["units"]})
    for slug, line in prompts.items():
        encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)

    phrases = read(PHRASES)["phrases"]
    for variety in ("saudi", "msa"):
        for slug, line in phrase_clips(phrases, variety):
            path = ask_clip_path(variety, "female", slug)
            other = ask_clip_path("saudi", "female", slug)
            if slug.startswith("number-") and variety == "msa":
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(other.read_bytes())
            else:
                encode(synthesize_wav, path, line)
        print(f"Encoded {variety} phrase clips", flush=True)
    write_ask_manifest(phrases)


if __name__ == "__main__":
    main()
