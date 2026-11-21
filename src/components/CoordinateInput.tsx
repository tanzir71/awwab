import { useCopy } from "@/lib/copy";
import { coordinateLimits, formatInputNumber, readSignedNumber } from "@/lib/localeNumbers";

export function CoordinateInput({ name, value, required = false }: {
  name: keyof typeof coordinateLimits; value?: number; required?: boolean;
}) {
  const { language, locale, t } = useCopy();
  const native = language === "en";
  const max = coordinateLimits[name];
  return <input name={name} type={native ? "number" : "text"} dir="ltr" required={required}
    min={native ? -max : undefined} max={native ? max : undefined} step={native ? "any" : undefined}
    defaultValue={value === undefined ? undefined : formatInputNumber(value, locale)}
    onInput={event => {
      const input = event.currentTarget;
      const raw = input.value.trim();
      if (native || (!raw && !required)) {
        input.setCustomValidity("");
        return;
      }
      const number = readSignedNumber(raw, locale);
      input.setCustomValidity(number === undefined ? t("zakatEnterAmount") : number < -max ? t("zakatAmountMin", { min: -max })
        : number > max ? t("zakatAmountMax", { max }) : "");
    }} />;
}
