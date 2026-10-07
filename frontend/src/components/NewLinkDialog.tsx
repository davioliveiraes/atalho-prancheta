import { QrCode } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, linkApi } from "../lib/api";
import { SLUG_HINT, SLUG_MAX_LENGTH } from "../lib/format";
import { useSubdomainBase } from "../lib/siteConfig";
import type { CreateLinkPayload, LinkDetail } from "../types";
import { Dialog } from "./Dialog";
import { Affix, ErrorLine } from "./elements";
import { LinkNameField } from "./LinkNameField";

/** Prefixo real do host: o que a API vai devolver em `short_url`. */
function codePrefix() {
  return `${window.location.host}/`;
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
  const [subdomain, setSubdomain] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  // null enquanto carrega e quando a instalação não serve subdomínio: nos dois
  // casos o campo não aparece, e é o lado seguro do engano.
  const subdomainBase = useSubdomainBase();

  useEffect(() => {
    if (!open) return;
    setOriginalUrl("");
    setShortCode("");
    setSubdomain("");
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
    if (subdomain) payload.subdomain = subdomain;
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
  const FIELDS = ["original_url", "short_code", "subdomain", "expires_at", "max_clicks"];
  const looseError =
    error && !Object.keys(error.fields).some((key) => FIELDS.includes(key)) ? error.message : null;

  /*
   * O código do caminho (`dominio/aB3xY9`) muda de papel conforme a instalação.
   *
   * Sem subdomínio, ele é o nome do link: o que se divulga, e por isso fixo.
   * Com subdomínio, o nome passa a ser o subdomínio — que o dono troca quando
   * quiser —, e o código vira o endereço fixo: nunca muda, e é para ele que o
   * QR Code aponta. Na API é sempre o `short_code`.
   */
  const pathField = (
    <div className="field">
      <label htmlFor="f-code">
        {subdomainBase ? "Endereço fixo" : "Nome do link"}{" "}
        <span style={{ color: "var(--ink-disabled)" }}>
          — opcional, sorteamos 6 caracteres se vazio
        </span>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <Affix side="left">{codePrefix()}</Affix>
        <input
          id="f-code"
          className="input"
          type="text"
          maxLength={SLUG_MAX_LENGTH}
          placeholder={subdomainBase ? undefined : "grupowhatsempresa"}
          value={shortCode}
          aria-invalid={error?.field("short_code") ? true : undefined}
          aria-describedby="f-code-hint"
          style={error?.field("short_code") ? ERROR_BORDER : undefined}
          onChange={(event) => setShortCode(event.target.value)}
        />
      </div>
      {error?.field("short_code") && <ErrorLine>{error.field("short_code")}</ErrorLine>}
      <span className="field-hint" id="f-code-hint">
        {subdomainBase
          ? "Nunca muda, e é para ele que o QR Code aponta — por isso o papel impresso sobrevive a uma troca de nome. "
          : "O endereço que você divulga. Depois de criado ele não muda — outro nome, só criando outro link. "}
        {SLUG_HINT}
      </span>
    </div>
  );

  const destinationField = (
    <div className="field">
      <label htmlFor="f-url">Destino</label>
      {/* Ver o campo equivalente da home: `url` recusaria endereço sem
          esquema, que é a forma que se cola do navegador. */}
      <input
        id="f-url"
        className="input"
        type="text"
        inputMode="url"
        autoComplete="url"
        required
        placeholder="https://exemplo.com/pagina"
        value={originalUrl}
        aria-invalid={error?.field("original_url") ? true : undefined}
        aria-describedby="f-url-hint"
        style={error?.field("original_url") ? ERROR_BORDER : undefined}
        onChange={(event) => setOriginalUrl(event.target.value)}
      />
      {error?.field("original_url") && <ErrorLine>{error.field("original_url")}</ErrorLine>}
      <span className="field-hint" id="f-url-hint">
        {subdomainBase
          ? "Para onde o link leva. Pode ser trocado quando quiser, assim como o nome — dá para criar agora apontando para uma página provisória e corrigir depois."
          : "Para onde o link leva. Pode ser trocado quando quiser, sem mudar o nome — dá para criar agora apontando para uma página provisória e corrigir depois."}
      </span>
    </div>
  );

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

        {/* O nome vem primeiro — é o que se divulga —, e depois o destino.
            Qual campo é o nome depende da instalação: ver `pathField`. */}
        {subdomainBase ? (
          <>
            <LinkNameField
              id="f-subdomain"
              base={subdomainBase}
              value={subdomain}
              onChange={setSubdomain}
              error={error?.field("subdomain")}
              optional
              hint={
                <>
                  O endereço que você divulga. Dá para trocar depois — o QR Code não muda, porque
                  aponta para o endereço fixo, mais abaixo. {SLUG_HINT}
                </>
              }
            />
            {destinationField}
            {pathField}
          </>
        ) : (
          <>
            {pathField}
            {destinationField}
          </>
        )}

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
