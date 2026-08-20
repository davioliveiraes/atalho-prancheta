import { AlertCircle, Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { STATE_LABEL, STATE_TAG_CLASS } from "../lib/format";
import type { LinkState } from "../types";

/** Tag de estado do link — o mapa de cor vive em format.ts, não aqui. */
export function StateTag({ state }: { state: LinkState }) {
  return <span className={STATE_TAG_CLASS[state]}>{STATE_LABEL[state]}</span>;
}

export function CopyButton({
  value,
  label = "Copiar",
  disabled,
  height,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
  height?: number;
}) {
  const [copied, setCopied] = useState(false);

  // 2s de troca de rótulo, sem toast.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={disabled}
      style={height ? { height } : undefined}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
    >
      {copied ? <Check size={15} strokeWidth={1.5} /> : <Copy size={15} strokeWidth={1.5} />}
      {copied ? "Copiado" : label}
    </button>
  );
}

/** Linha de erro da API — texto literal, hierarquia em vez de cor nova. */
export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="form-error" role="alert">
      <AlertCircle size={15} strokeWidth={1.5} />
      <span>{children}</span>
    </p>
  );
}
