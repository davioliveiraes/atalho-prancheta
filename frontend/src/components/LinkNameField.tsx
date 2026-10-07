import type { CSSProperties, ReactNode } from "react";
import { subdomainPreview } from "../lib/api";
import { SLUG_MAX_LENGTH } from "../lib/format";
import { Affix, ErrorLine } from "./elements";

/**
 * O nome do link onde a instalação serve subdomínio: `wppdavi.atalhopr.app`.
 *
 * Com o subdomínio ligado, é ele o nome — o endereço que se divulga, e que o
 * dono pode trocar. O código do caminho (`atalhopr.app/aB3xY9`) vira o endereço
 * fixo: não muda nunca, e é para ele que o QR Code aponta. Por isso trocar o
 * nome não invalida papel impresso.
 *
 * Os três formulários que escolhem um nome — o encurtador da home, o "Novo
 * link" e o "Editar link" — usam este campo, e dizem a mesma coisa do mesmo
 * jeito.
 */
export function LinkNameField({
  id,
  base,
  value,
  onChange,
  error,
  current,
  optional,
  hint,
  inputStyle,
}: {
  id: string;
  /** O domínio sob o qual o nome responde, de `/api/config/`. */
  base: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /**
   * O nome que o link tem hoje, na edição. Com ele o campo avisa, antes de
   * salvar, que o endereço antigo vai deixar de responder.
   */
  current?: string | null;
  /** Rótulo com "— opcional". */
  optional?: boolean;
  /** O texto de apoio de sempre, quando não há nada mais urgente a dizer. */
  hint: ReactNode;
  inputStyle?: CSSProperties;
}) {
  // A forma em que o backend vai gravar: o navegador manda o Host em
  // minúsculas, e o campo guarda o que de fato vai responder.
  const normalized = value.trim().toLowerCase();
  const preview = subdomainPreview(base, normalized);
  const renamed = current != null && normalized !== current;

  return (
    <div className="field">
      <label htmlFor={id}>
        Nome do link
        {optional && <span style={{ color: "var(--ink-disabled)" }}> — opcional</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <input
          id={id}
          className="input"
          type="text"
          maxLength={SLUG_MAX_LENGTH}
          placeholder="wppdavi"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          style={{
            ...inputStyle,
            ...(error ? { borderColor: "var(--color-accent-800)" } : {}),
          }}
          onChange={(event) => onChange(event.target.value)}
        />
        <Affix side="right">.{base}</Affix>
      </div>

      {error ? (
        <ErrorLine>{error}</ErrorLine>
      ) : (
        <span className="field-hint" id={`${id}-hint`}>
          {preview && (
            <>
              <span style={{ color: "var(--ink-secondary)" }}>{preview}</span>
              {". "}
            </>
          )}
          {/* `wppDavi` digitado vira `wppdavi`: dizer antes evita a surpresa de
              ver o nome "mudado" depois de salvar. */}
          {value !== value.toLowerCase() &&
            "Maiúsculas viram minúsculas — endereço de internet não as diferencia. "}
          {renamed ? (
            <span style={{ color: "var(--ink-body)" }}>
              Ao salvar, {current}.{base} deixa de responder — quem tiver o endereço antigo cai em
              "código não encontrado". O QR Code continua valendo.
            </span>
          ) : (
            hint
          )}
        </span>
      )}
    </div>
  );
}
