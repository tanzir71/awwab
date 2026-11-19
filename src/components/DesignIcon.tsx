import { asset } from "@/lib/config";

export function DesignIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return <img className={className} width={size} height={size} src={asset(`design/${name}.svg`)} alt="" aria-hidden="true" />;
}

export function Wordmark() {
  return <span className="wordmark">awwab<DesignIcon name="desk-fatha" className="wordmark-mark" size={16} /></span>;
}
