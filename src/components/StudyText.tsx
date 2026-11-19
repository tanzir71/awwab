import { Fragment } from "react";
import { ArabicText } from "./ArabicText";

const arabicRun = /([\p{Script=Arabic}\p{M}]+(?:[ \t]+[\p{Script=Arabic}\p{M}]+)*)/u;

export function StudyText({ text }: { text: string }) {
  return <>{text.split(arabicRun).map((part, index) => index % 2
    ? <ArabicText key={index} text={part} preserveSeparators /> : <Fragment key={index}>{part}</Fragment>)}</>;
}
