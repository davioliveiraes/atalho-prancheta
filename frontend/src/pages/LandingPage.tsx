import { ExternalLink, QrCode } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { NewLinkDialog } from "../components/NewLinkDialog";
import { QrDialog } from "../components/QrDialog";
import { CopyButton, ErrorLine } from "../components/elements";
import { Plate } from "../components/Plate";
import { ApiError, linkApi, redirectUrl } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useIsMobile } from "../lib/useIsMobile";
import type { LinkDetail } from "../types";

const MEASURES = [
  {
    title: "Totais e únicos",
    text: "Cada acesso grava IP, user agent, referência e horário. O clique único é contado uma vez por IP.",
  },
  {
    title: "Expiração e limite",
    text: "Defina data de expiração ou máximo de cliques únicos. Atingido o teto, o link responde 403 em vez de redirecionar.",
  },
  {
    title: "QR Code automático",
    text: "Todo link nasce com um PNG gerado no servidor, pronto para baixar e imprimir.",
  },
];

export function LandingPage() {
  const [url, setUrl] = useState("");
  const [created, setCreated] = useState<LinkDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const mobile = useIsMobile();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCreated(await linkApi.create({ original_url: url }));
      setUrl("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
      setCreated(null);
    } finally {
      setBusy(false);
    }
  }

  const urlError = error?.field("original_url") ?? (error ? error.message : undefined);

  return (
    <>
      {/* Herói */}
      <section
        className="shell grid grid-7-5"
        style={{
          paddingTop: mobile ? 32 : 72,
          paddingBottom: mobile ? 40 : 48,
          gap: mobile ? 32 : 64,
          alignItems: "start",
        }}
      >
        <div className="stack" style={{ gap: 24 }}>
          <h1 className="display">
            <span style={{ display: "block" }}>Encurte o link.</span>
            <span style={{ display: "block" }}>Meça cada clique.</span>
          </h1>

          <p className="lede" style={{ lineHeight: "24px", maxWidth: "56ch" }}>
            {mobile
              ? "Código curto, QR Code e contagem de cliques totais e únicos por IP."
              : "Cole a URL, receba um código curto e um QR Code. A contagem separa cliques totais de únicos por IP, e você pode fechar o link por data de expiração ou por limite de acessos."}
          </p>

          <form
            onSubmit={submit}
            className={mobile ? "stack-mobile" : undefined}
            style={{ display: "flex", gap: 10, alignItems: "stretch", maxWidth: 640 }}
          >
            <label className="sr-only" htmlFor="original_url">
              URL de destino
            </label>
            <input
              id="original_url"
              className="input"
              type="url"
              required
              placeholder="https://exemplo.com/pagina"
              value={url}
              aria-invalid={urlError ? true : undefined}
              style={{ flex: 1, minHeight: mobile ? 48 : 44, fontSize: 15 }}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !url}
              style={{ minHeight: mobile ? 48 : 44, paddingInline: 22 }}
            >
              {busy ? "Encurtando…" : "Encurtar"}
            </button>
          </form>

          {urlError && <ErrorLine>{urlError}</ErrorLine>}

          <p
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 13,
              lineHeight: "20px",
              color: "var(--ink-meta)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                // padding de 12px é a área de toque da 1h; o minHeight garante
                // os 44px do checklist, que só o padding não alcança.
                height: "auto",
                minHeight: mobile ? 44 : undefined,
                padding: mobile ? "12px 0" : 0,
                fontSize: 13,
                color: "var(--color-accent-700)",
              }}
              onClick={() => setAdvanced(true)}
            >
              Opções avançadas
            </button>
            <span>código personalizado · expiração · limite de cliques</span>
          </p>
        </div>

        <ResultPlate link={created} onQr={() => setQrOpen(true)} mobile={mobile} />
      </section>

      {/* Faixa de medições */}
      <section className="shell" style={{ paddingTop: 24, paddingBottom: 72 }}>
        <p className="kicker">02 · O que a API mede</p>
        <hr className="rule" style={{ marginTop: 12, marginBottom: 40 }} />
        <div className="grid grid-3" style={{ gap: mobile ? 24 : 40 }}>
          {MEASURES.map((item) => (
            <Plate as="article" key={item.title}>
              <div className="stack" style={{ padding: 24, gap: 12 }}>
                <h3 style={{ fontSize: 22, lineHeight: "24px" }}>{item.title}</h3>
                <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-secondary)" }}>
                  {item.text}
                </p>
              </div>
            </Plate>
          ))}
        </div>
      </section>

      <footer
        style={{
          padding: "20px var(--gutter)",
          borderTop: "1px solid var(--color-divider)",
          fontSize: 13,
          lineHeight: "20px",
          color: "var(--ink-small)",
        }}
      >
        Atalho Prancheta · API Django REST Framework · /api/urls/
      </footer>

      <QrDialog
        open={qrOpen}
        shortCode={created?.short_code ?? null}
        onClose={() => setQrOpen(false)}
      />

      <NewLinkDialog
        open={advanced}
        onClose={() => setAdvanced(false)}
        onCreated={(link) => {
          setAdvanced(false);
          setError(null);
          setCreated(link);
        }}
      />
    </>
  );
}

/**
 * Placa do resultado. Fica visível desde o início com rótulos e travessões —
 * nunca com número inventado antes do primeiro envio.
 */
function ResultPlate({
  link,
  onQr,
  mobile,
}: {
  link: LinkDetail | null;
  onQr: () => void;
  mobile: boolean;
}) {
  return (
    <Plate
      // No mobile o cabeçalho é uma linha só: título e código na mesma célula.
      title={mobile ? `Link criado${link ? ` · ${link.short_code}` : ""}` : "Link criado"}
      cells={mobile ? undefined : [link ? "201" : "—"]}
      style={mobile ? { marginTop: 32 } : undefined}
    >
      <div className="stack" style={{ padding: 20, gap: 20 }}>
        <div className="stack" style={{ gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ink-small)",
            }}
          >
            Link curto
          </span>
          <span
            className="break"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: mobile ? 19 : 26,
              lineHeight: mobile ? "24px" : "30px",
              letterSpacing: ".02em",
              color: link ? "var(--color-text)" : "var(--ink-disabled)",
            }}
          >
            {link ? link.short_url : "—"}
          </span>
        </div>

        {/* No mobile só as duas ações diretas, cada uma com 44px e metade da largura. */}
        <div
          className={mobile ? "split-mobile" : undefined}
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          <CopyButton value={link?.short_url ?? ""} disabled={!link} height={mobile ? 44 : undefined} />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!link}
            style={mobile ? { height: 44 } : undefined}
            onClick={onQr}
          >
            <QrCode size={15} strokeWidth={1.5} />
            QR Code
          </button>
          {!mobile && (
            <a
              className="btn btn-ghost"
              href={link ? redirectUrl(link.short_code) : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!link || undefined}
              style={link ? undefined : { pointerEvents: "none", opacity: 0.45 }}
            >
              <ExternalLink size={15} strokeWidth={1.5} />
              Abrir
            </a>
          )}
        </div>

        <hr className="rule" />

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "8px 20px",
            fontSize: 14,
            margin: 0,
          }}
        >
          <Row term="Destino">
            <span className="break">{link ? link.original_url : "—"}</span>
          </Row>
          <Row term="Código">{link ? link.short_code : "—"}</Row>
          <Row term="Expira em">{link ? formatDateTime(link.expires_at) : "—"}</Row>
          <Row term="Limite de cliques">
            {link ? (link.max_clicks ? String(link.max_clicks) : "Ilimitado") : "Ilimitado"}
          </Row>
        </dl>
      </div>
    </Plate>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt style={{ color: "var(--ink-meta)", whiteSpace: "nowrap" }}>{term}</dt>
      <dd style={{ margin: 0, minWidth: 0 }}>{children}</dd>
    </>
  );
}
