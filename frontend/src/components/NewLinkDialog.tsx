import { QrCode } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, linkApi } from "../lib/api";
import type { CreateLinkPayload, LinkDetail } from "../types";
import { Dialog } from "./Dialog";
import { ErrorLine } from "./elements";

/** Prefixo real do host: o que a API vai devolver em `short_url`. */
function codePrefix() {
  return `${window.location.host}/api/r/`;
}

export function NewLinkDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (link: LinkDetail) => void;
}) {
  const [originalUrl, setOriginalUrl] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOriginalUrl("");
    setShortCode("");
    setExpiresAt("");
    setMaxClicks("");
    setError(null);
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload: CreateLinkPayload = { original_url: originalUrl };
    if (shortCode) payload.short_code = shortCode;
    if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
    // Vazio ou 0 significam ilimitado: o campo não é enviado. Qualquer outro
    // valor vai para a API — inclusive negativo, para que o erro venha de lá
    // com o texto do serializer em vez de sumir em silêncio.
    const max = maxClicks.trim();
    if (max !== "" && Number(max) !== 0) payload.max_clicks = Number(max);

    try {
      onCreated(await linkApi.create(payload));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setBusy(false);
    }
  }

  // Erro que não pertence a nenhum campo do formulário.
  const FIELDS = ["original_url", "short_code", "expires_at", "max_clicks"];
  const looseError =
    error && !Object.keys(error.fields).some((key) => FIELDS.includes(key)) ? error.message : null;

  return (
    <Dialog
      open={open}
      title="Novo link"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ height: 38 }} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            form="new-link-form"
            style={{ height: 38 }}
            disabled={busy}
          >
            {busy ? "Criando…" : "Criar link"}
          </button>
        </>
      }
    >
      <form id="new-link-form" className="dialog-body" onSubmit={submit}>
        {looseError && <ErrorLine>{looseError}</ErrorLine>}

        <div className="field">
          <label htmlFor="f-url">URL original</label>
          <input
            id="f-url"
            className="input"
            type="url"
            required
            placeholder="https://exemplo.com/pagina"
            value={originalUrl}
            aria-invalid={error?.field("original_url") ? true : undefined}
            style={error?.field("original_url") ? ERROR_BORDER : undefined}
            onChange={(event) => setOriginalUrl(event.target.value)}
          />
          {error?.field("original_url") && <ErrorLine>{error.field("original_url")}</ErrorLine>}
        </div>

        <div className="field">
          <label htmlFor="f-code">
            Código curto{" "}
            <span style={{ color: "var(--ink-disabled)" }}>
              — opcional, gerado com 6 caracteres se vazio
            </span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span
              style={{
                minHeight: 36,
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                border: "1px solid var(--color-divider)",
                borderRight: 0,
                fontSize: 14,
                whiteSpace: "nowrap",
                color: "var(--ink-meta)",
              }}
            >
              {codePrefix()}
            </span>
            <input
              id="f-code"
              className="input"
              type="text"
              maxLength={10}
              value={shortCode}
              aria-invalid={error?.field("short_code") ? true : undefined}
              style={error?.field("short_code") ? ERROR_BORDER : undefined}
              onChange={(event) => setShortCode(event.target.value)}
            />
          </div>
          {error?.field("short_code") && <ErrorLine>{error.field("short_code")}</ErrorLine>}
          <span className="field-hint">Somente letras e números, no mínimo 3 caracteres.</span>
        </div>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="f-expires">
              Expira em <span style={{ color: "var(--ink-disabled)" }}>— opcional</span>
            </label>
            <input
              id="f-expires"
              className="input"
              type="datetime-local"
              value={expiresAt}
              aria-invalid={error?.field("expires_at") ? true : undefined}
              style={error?.field("expires_at") ? ERROR_BORDER : undefined}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
            {error?.field("expires_at") && <ErrorLine>{error.field("expires_at")}</ErrorLine>}
            <span className="field-hint">Precisa ser no futuro.</span>
          </div>

          <div className="field">
            <label htmlFor="f-max">
              Limite de cliques únicos{" "}
              <span style={{ color: "var(--ink-disabled)" }}>— opcional</span>
            </label>
            <input
              id="f-max"
              className="input tnum"
              type="number"
              value={maxClicks}
              aria-invalid={error?.field("max_clicks") ? true : undefined}
              style={error?.field("max_clicks") ? ERROR_BORDER : undefined}
              onChange={(event) => setMaxClicks(event.target.value)}
            />
            {error?.field("max_clicks") && <ErrorLine>{error.field("max_clicks")}</ErrorLine>}
            <span className="field-hint">Vazio ou 0 = ilimitado.</span>
          </div>
        </div>

        {/* Informação, não campo: não há controle a configurar. */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 14px",
            border: "1px solid var(--color-divider)",
          }}
        >
          <QrCode
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            style={{ flex: "none", marginTop: 2, color: "var(--color-accent-700)" }}
          />
          <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-secondary)" }}>
            O QR Code é gerado no servidor no momento da criação — nenhuma configuração
            necessária.
          </span>
        </div>
      </form>
    </Dialog>
  );
}

const ERROR_BORDER = { borderColor: "var(--color-accent-800)" } as const;
