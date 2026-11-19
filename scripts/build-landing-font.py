"""Subset the landing page's Arabic font with FontTools and Brotli."""

import json
import re
from pathlib import Path

from fontTools import subset


root = Path(__file__).resolve().parent.parent
source = root / "node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2"
return_copy = json.loads((root / "docs/content/return.json").read_text(encoding="utf-8"))
anatomy = json.loads((root / "docs/content/word-anatomy.sample.json").read_text(encoding="utf-8"))
landing = (root / "index.html").read_text(encoding="utf-8")
texts = (return_copy["welcome"]["arabic"], anatomy["word"], landing)
arabic = " ".join(re.findall(r"[\u0600-\u06ff]+", " ".join(texts)))

options = subset.Options(flavor="woff2")
font = subset.load_font(source, options)
font.recalcTimestamp = False
subsetter = subset.Subsetter(options)
subsetter.populate(text=arabic)
subsetter.subset(font)
subset.save_font(font, root / "public/landing/noto-sans-arabic.woff2", options)
