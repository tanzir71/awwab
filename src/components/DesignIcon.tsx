import { asset } from "@/lib/config";

export function DesignIcon({ name, size = 20, height = size, className }: { name: string; size?: number; height?: number; className?: string }) {
  const directional = /(?:^|-)(?:chev-[lr]|chevron-[lr]|arrow-[lr])$/.test(name);
  return <img className={[className, directional && "icon-dir"].filter(Boolean).join(" ") || undefined} width={size} height={height} src={asset(`design/${name}.svg`)} alt="" aria-hidden="true" />;
}

export function Wordmark({ print = false }: { print?: boolean }) {
  return <span className={print ? "wordmark wordmark-print" : "wordmark"} dir="ltr">awwab{print
    ? <img className="wordmark-mark" src={asset("design/print-fatha.svg")} alt="" />
    : <DesignIcon name="desk-fatha" className="wordmark-mark" size={16} />}</span>;
}
