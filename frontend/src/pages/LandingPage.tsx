import { ExternalLink, QrCode, SlidersHorizontal } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { NewLinkDialog } from "../components/NewLinkDialog";
import { QrDialog } from "../components/QrDialog";
import { Affix, CopyButton, ErrorLine } from "../components/elements";
import { Plate } from "../components/Plate";
import { ApiError, linkApi, redirectUrl, subdomainPreview } from "../lib/api";
import { useSession } from "../lib/auth";
import { SLUG_HINT, SLUG_MAX_LENGTH, formatDateTime } from "../lib/format";
import { Link } from "../lib/router";
import { useSubdomainBase } from "../lib/siteConfig";
import { useIsMobile } from "../lib/useIsMobile";
import type { CreateLinkPayload, LinkDetail } from "../types";

/**
 * A faixa da segunda tela: seis fichas, duas fileiras de três.
 *
 * Cada uma descreve algo que a aplicação faz de verdade — nada de promessa de
 * roadmap. É função, e não constante, porque a ficha do endereço muda de texto
 * onde o subdomínio está ligado.
 */
function features(subdomainBase: string | null) {
  return [
    {
      title: "Totais e únicos",
      text: "Cada acesso grava IP, user agent, referência e horário. O clique único é contado uma vez por IP.",
    },
    {
      title: "Destino atualizável",
      text: "Trocar o destino não mexe no endereço divulgado. O desvio é temporário e vai sem cache: o próximo acesso já cai no lugar novo, inclusive o de quem já clicou antes.",
    },
    {
      title: "Endereço escolhido",
      text: subdomainBase
        ? "Em vez do código sorteado, escolha o seu — letras sem acento, números e hífen. E o mesmo link ainda pode ganhar um subdomínio como segundo endereço."
        : "Em vez do código sorteado de seis caracteres, escolha o seu: letras sem acento, números e hífen, de 3 a 32 caracteres.",
    },
    {
      title: "Expiração e limite",
      text: "Defina data de expiração ou máximo de cliques únicos. Atingido o teto, o link responde 403 sem revelar para onde apontava.",
    },
    {
      title: "QR Code automático",
      text: "Todo link nasce com um PNG gerado no servidor. Como ele aponta para o endereço curto, o papel impresso continua valendo depois de trocar o destino.",
    },
    {
      title: "Painel por conta",
      text: "Encurtar não exige conta. Com conta, o link entra num painel com cliques por dia, acessos recentes, busca e filtros — e cada painel enxerga apenas os próprios links.",
    },
  ];
}

export function LandingPage() {
  const [url, setUrl] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [created, setCreated] = useState<LinkDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const mobile = useIsMobile();
  const session = useSession();

  // null enquanto carrega e quando a instalação não serve subdomínio: nos dois
  // casos o campo não aparece, e o encurtador segue sendo de um campo só.
  const subdomainBase = useSubdomainBase();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: CreateLinkPayload = { original_url: url };
      if (subdomain) payload.subdomain = subdomain;
      setCreated(await linkApi.create(payload));
      setUrl("");
      setSubdomain("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
      setCreated(null);
    } finally {
      setBusy(false);
    }
  }

  // Erro que não pertence a nenhum campo — recusa por excesso de criações, por
  // exemplo — continua aparecendo sob a URL, que é o campo principal. O do
  // subdomínio vai para o subdomínio, e não para os dois lugares.
  const FIELDS = ["original_url", "subdomain"];
  const looseError =
    error && !Object.keys(error.fields).some((key) => FIELDS.includes(key))
      ? error.message
      : undefined;
  const urlError = error?.field("original_url") ?? looseError;
  const subdomainError = error?.field("subdomain");

  return (
    <>
      <div className="screen">
        {/* Herói — primeira tela cheia */}
        <section
          className="shell grid grid-7-5 screen-body"
          style={{
            // No desktop o padding e simetrico: a tela cheia ja centra o bloco,
            // entao a assimetria de antes deslocaria o centro optico.
            paddingTop: mobile ? 32 : 56,
            paddingBottom: mobile ? 40 : 56,
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

            <form onSubmit={submit} className="stack" style={{ gap: 12, maxWidth: 640 }}>
              <div
                className={mobile ? "stack-mobile" : undefined}
                style={{ display: "flex", gap: 10, alignItems: "stretch" }}
              >
                <label className="sr-only" htmlFor="original_url">
                  URL de destino
                </label>
                {/* Texto, e não `url`: o navegador recusaria
                    `chat.whatsapp.com/L1k8` por falta de esquema, e é justamente
                    a forma que se copia da barra de endereço. Quem completa o
                    `https://` e valida o resto é o backend. */}
                <input
                  id="original_url"
                  className="input"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
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
              </div>

              {/* Só existe onde a instalação serve subdomínio — ver /api/config/.
                  Fica abaixo da linha principal, e não dentro dela: quem veio
                  colar uma URL e apertar Enter continua com um campo só. */}
              {subdomainBase && (
                <div className="field">
                  <label htmlFor="landing-subdomain">
                    Subdomínio{" "}
                    <span style={{ color: "var(--ink-disabled)" }}>
                      — opcional, um segundo endereço para o mesmo link
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    <input
                      id="landing-subdomain"
                      className="input"
                      type="text"
                      maxLength={SLUG_MAX_LENGTH}
                      value={subdomain}
                      aria-invalid={subdomainError ? true : undefined}
                      style={{ minHeight: mobile ? 48 : 44 }}
                      onChange={(event) => setSubdomain(event.target.value)}
                    />
                    <Affix side="right">.{subdomainBase}</Affix>
                  </div>
                  {subdomainError ? (
                    <ErrorLine>{subdomainError}</ErrorLine>
                  ) : (
                    <span className="field-hint">
                      {subdomainPreview(subdomainBase, subdomain.trim().toLowerCase()) ??
                        (session
                          ? SLUG_HINT
                          : // Link criado sem conta não pertence a ninguém, e por
                            // isso ninguém o edita depois. O nome escolhido aqui
                            // fica como está.
                            `${SLUG_HINT} Sem conta, o nome não pode ser trocado depois.`)}
                    </span>
                  )}
                </div>
              )}
            </form>

            {urlError && <ErrorLine>{urlError}</ErrorLine>}

            {/* Botão com moldura, e não texto solto numa linha de 13px: é aqui
                que mora a personalização do link, e um `btn-ghost` no meio de
                uma frase cinza passava por legenda. */}
            <div className="stack" style={{ gap: 8, alignItems: "flex-start" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: mobile ? 44 : undefined }}
                onClick={() => setAdvanced(true)}
              >
                <SlidersHorizontal size={15} strokeWidth={1.5} aria-hidden="true" />
                Personalizar o link
              </button>
              <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-meta)" }}>
                código personalizado{subdomainBase ? " · subdomínio" : ""} · expiração · limite de
                cliques
              </span>
            </div>
          </div>

          <ResultPlate link={created} onQr={() => setQrOpen(true)} mobile={mobile} />
        </section>
      </div>

      <div className="screen">
        {/* Faixa de recursos — segunda tela cheia, com o rodapé no pé dela */}
        <section
          className="shell screen-body screen-spread"
          style={{ paddingTop: mobile ? 24 : 56, paddingBottom: mobile ? 40 : 56 }}
        >
          <p className="kicker">02 · O que ela faz</p>
          <hr className="rule" style={{ marginTop: 12, marginBottom: 40 }} />
          <div className="grid grid-3 screen-middle" style={{ gap: mobile ? 24 : 40 }}>
            {features(subdomainBase).map((item) => (
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

          {/* Quem rolou a pagina inteira sem encurtar nada em geral esta com a
              pergunta anterior: para que serve. */}
          <div
            className="row row-wrap"
            style={{ marginTop: mobile ? 24 : 40, gap: 12, alignItems: "baseline" }}
          >
            <Link
              className="btn btn-secondary"
              to="/como-usar"
              style={{ minHeight: mobile ? 44 : undefined }}
            >
              Como usar
            </Link>
            <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-meta)" }}>
              seis passos, do primeiro link ao destino trocado depois
            </span>
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
      </div>

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

        {/* O segundo endereço, quando o link nasceu com subdomínio. Só aparece
            depois de criado — antes disso não há endereço nenhum a mostrar. */}
        {link?.subdomain_url && (
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
              Também em
            </span>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
            >
              <span
                className="break"
                style={{ fontSize: 15, lineHeight: "22px", color: "var(--ink-secondary)" }}
              >
                {link.subdomain_url}
              </span>
              <CopyButton
                value={link.subdomain_url}
                ariaLabel="Copiar endereço de subdomínio"
                height={mobile ? 44 : 30}
              />
            </div>
          </div>
        )}

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
          <Row term="Subdomínio">{link?.subdomain ?? "—"}</Row>
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
