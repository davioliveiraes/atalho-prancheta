import { AlertCircle, Check, Copy, Eye, EyeOff } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { STATE_LABEL, STATE_TAG_CLASS } from "../lib/format";
import type { LinkState } from "../types";

/** Tag de estado do link — o mapa de cor vive em format.ts, não aqui. */
export function StateTag({ state }: { state: LinkState }) {
  return <span className={STATE_TAG_CLASS[state]}>{STATE_LABEL[state]}</span>;
}

export function CopyButton({
  value,
  label = "Copiar",
  ariaLabel,
  disabled,
  height,
}: {
  value: string;
  label?: string;
  /**
   * Nome acessível, quando o rótulo visível não basta para distinguir.
   *
   * A home e o detalhe mostram dois botões "Copiar" lado a lado — um do
   * endereço de código, outro do de subdomínio. Quem enxerga vê qual é qual
   * pela posição; quem ouve, não.
   */
  ariaLabel?: string;
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
      aria-label={ariaLabel}
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

/**
 * Campo de senha com o olho de mostrar e ocultar.
 *
 * O estado começa oculto e vale só para este campo: nas duas senhas da criação
 * de conta, mostrar uma não mostra a outra — quem confere o que digitou numa
 * ainda quer a outra escondida.
 *
 * Ninguém digita senha de olho fechado sem errar, e errar aqui custa uma
 * mensagem que não diz qual das duas está diferente. O botão é `type="button"`
 * porque, dentro de um formulário, o padrão de um `<button>` é enviar.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  style,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  style?: CSSProperties;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        className="input"
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        aria-invalid={invalid ? true : undefined}
        style={style}
        onChange={(event) => onChange(event.target.value)}
      />
      {/* O rótulo diz o que o botão faz, e não o estado em que ele está. */}
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeOff size={17} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Eye size={17} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Pedaço fixo colado a um campo: o `atalho.app/` antes do código, o
 * `.atalho.app` depois do subdomínio.
 *
 * Não é texto de ajuda — é a parte do endereço que o usuário não digita, e por
 * isso divide a moldura com o campo em vez de ficar embaixo dele.
 */
export function Affix({ children, side }: { children: ReactNode; side: "left" | "right" }) {
  return (
    <span
      style={{
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        border: "1px solid var(--color-divider)",
        ...(side === "left" ? { borderRight: 0 } : { borderLeft: 0 }),
        fontSize: 14,
        whiteSpace: "nowrap",
        color: "var(--ink-meta)",
      }}
    >
      {children}
    </span>
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
