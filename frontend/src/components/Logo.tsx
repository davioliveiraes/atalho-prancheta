import { ArrowUpRight } from "lucide-react";

export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Atalho — página inicial">
      <span className="logo__mark" aria-hidden="true">
        <ArrowUpRight size={19} strokeWidth={2.6} />
      </span>
      <span>atalho</span>
      <span className="logo__dot">.</span>
    </a>
  );
}
