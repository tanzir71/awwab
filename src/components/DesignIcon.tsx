import { asset } from "@/lib/config";

export function DesignIcon({ name, size = 20, height = size, className }: { name: string; size?: number; height?: number; className?: string }) {
  const directional = /(?:^|-)(?:chev-[lr]|chevron-[lr]|arrow-[lr])$/.test(name);
  return <img className={[className, directional && "icon-dir"].filter(Boolean).join(" ") || undefined} width={size} height={height} src={asset(`design/${name}.svg`)} alt="" aria-hidden="true" />;
}

export function Wordmark() {
  return <span className="wordmark" dir="ltr">awwab<DesignIcon name="desk-fatha" className="wordmark-mark" size={16} /></span>;
}
