"""Build the offline spoken Arabic clips with local Piper or Nabra models and FFmpeg."""

import argparse
from array import array
import io
import json
from pathlib import Path
import subprocess
import wave

ROOT = Path(__file__).resolve().parent.parent
PHRASES = ROOT / "handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json"
CONTENT = ROOT / "docs/content"
OUTPUT = ROOT / "public/packs"
MODEL = "https://huggingface.co/vadimbelsky/arabic-emirati-female-piper/tree/cfe173969620e40be65b5dd8ed4d97d55a864325"
SPEAK_COURSES = ("saudi-a2", "saudi-b1", "gulf-a1")


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
    path.parent.mkdir(parents=True, exist_ok=True)
    wav = io.BytesIO()
    with wave.open(wav, "wb") as stream:
        synthesize_wav(text, stream)
    result = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", "pipe:0", "-af",
         "loudnorm=I=-16:TP=-1:LRA=7,adelay=150,apad=pad_dur=0.15", "-ac", "1", "-ar", "48000",
         "-c:a", "libopus", "-b:a", "32k", "-f", "ogg", "pipe:1"],
        input=wav.getvalue(), stdout=subprocess.PIPE, check=True,
    )
    if len(result.stdout) <= 500:
        raise ValueError(f"Empty clip for {path.name}")
    path.write_bytes(result.stdout)


def course_clips(units):
    for unit in units:
        slug = unit["id"]
        for number, line in enumerate(unit["dialogue"], start=1):
            yield f"{slug}-line-{number}", line[0]
        for number, word in enumerate(unit["words"], start=1):
            yield f"{slug}-word-{number}", word["ar"]
        yield f"sign-{slug}", unit.get("signSpeech", unit["sign"])


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="Emirati Piper ONNX model, or extracted Nabra INT8 directory for msa-a1")
    parser.add_argument("--course", choices=(*SPEAK_COURSES, "msa-a1"), help="Only rebuild the selected Speak course")
    args = parser.parse_args()
    if args.course == "msa-a1":
        synthesize_wav = nabra_synthesizer(args.model)
        for slug, line in course_clips(read(CONTENT / "spoken-msa-a1.json")):
            encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)
        return

    from piper import PiperVoice

    synthesize_wav = PiperVoice.load(args.model).synthesize_wav
    for course in (args.course,) if args.course else SPEAK_COURSES:
        for slug, line in course_clips(read(CONTENT / f"spoken-{course}.json")):
            encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)
    if args.course:
        return

    units = read(CONTENT / "spoken-arabic.json")
    prompts = {"ghayn": "غَيْن", "mim": "مِيم", "bi": "بِ", "bu": "بُ"}
    prompts.update({f"sim-{i}": line["ar"] for i, line in enumerate(units["simDialogue"], start=1)})
    prompts.update({f"sim-word-{i}": line["ar"] for i, line in enumerate(units["simWords"], start=1)})
    prompts.update({f"sign-{unit['id']}": unit["sign"] for unit in units["units"]})
    for slug, line in prompts.items():
        encode(synthesize_wav, OUTPUT / "study-speech" / f"{slug}.opus", line)

    phrases = read(PHRASES)["phrases"]
    bytes_total = 0
    for variety in ("saudi", "msa"):
        for slug, line in phrase_clips(phrases, variety):
            path = OUTPUT / "phrases" / variety / "female" / f"{slug}.opus"
            other = OUTPUT / "phrases" / "saudi" / "female" / path.name
            if slug.startswith("number-") and variety == "msa":
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(other.read_bytes())
            else:
                encode(synthesize_wav, path, line)
            bytes_total += path.stat().st_size
        print(f"Encoded {variety} phrase clips", flush=True)
    write(CONTENT / "umrah-phrase-audio.json", {"version": 1, "bytes": bytes_total, "attribution": "Piper · Emirati Arabic voice", "source": MODEL, "generated": True, "voices": ["female"]})


if __name__ == "__main__":
    main()
