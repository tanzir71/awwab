const basmala = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
const openings = [basmala, "بّ" + basmala.slice(1)];

export function splitUthmaniOpening(text: string, reference: string) {
  // The connected-reading form in Tanzil starts with a doubled bāʾ.
  const opening = reference.endsWith(":1") && reference !== "1:1"
    ? openings.find(candidate => text.startsWith(candidate + " "))
    : undefined;
  return { opening, text: opening ? text.slice(opening.length + 1) : text };
}
