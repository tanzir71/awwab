import { Fragment } from "react";
import { ArabicText } from "./ArabicText";
import { useCopy } from "@/lib/copy";

const arabicRun = /([\p{Script=Arabic}\p{M}]+(?:[ \t]+[\p{Script=Arabic}\p{M}]+)*)/u;

export function StudyText({ text }: { text: string }) {
  return <>{text.split(arabicRun).map((part, index) => index % 2
    ? <ArabicText key={index} text={part} preserveSeparators /> : <Fragment key={index}>{part}</Fragment>)}</>;
}

const arabicPlaceholder = "\uFFFC";

export function StudyMessage({ id, arabic, values }: { id: string; arabic?: string; values?: Record<string, string | number> }) {
  const { t } = useCopy();
  if (!arabic) return <>{t(id, values)}</>;
  const parts = t(id, { ...values, arabic: arabicPlaceholder }).split(arabicPlaceholder);
  return <>{parts.map((part, index) => <Fragment key={index}>
    {index > 0 && <ArabicText text={arabic} preserveSeparators />}{part}
  </Fragment>)}</>;
}
