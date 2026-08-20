import { Copy, QrCode, Search } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { NewLinkDialog } from "../components/NewLinkDialog";
import { QrDialog } from "../components/QrDialog";
import { StateTag } from "../components/elements";
import { Plate } from "../components/Plate";
import { ApiError, type LinkSummary, linkApi } from "../lib/api";
import { formatDateShort, formatNumber, linkState } from "../lib/format";
import { Link, navigate } from "../lib/router";
import type { LinkListItem } from "../types";

const PAGE_SIZE = 10;

type StatusFilter = "all" | "active" | "inactive";

const STATUS_QUERY: Record<StatusFilter, boolean | null> = {
  all: null,
  active: true,
  inactive: false,
};

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ["all", "Todos"],
  ["active", "Ativos"],
  ["inactive", "Inativos"],
];

export function CardsPanelPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [cards, setCards] = useState<LinkListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<LinkSummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { search: term, isActive: STATUS_QUERY[status] };
    try {
      const list = await linkApi.list({ ...params, page });
      setTotal(list.count);
      setCards((current) => (page === 1 ? list.results : [...current, ...list.results]));
      if (page === 1) setSummary(await linkApi.summary(params));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setLoading(false);
    }
  }, [term, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const remaining = Math.max(0, total - cards.length);

  return (
    <main className="shell stack" style={{ paddingTop: 40, paddingBottom: 56, gap: 28 }}>
      <Plate title="Resumo da conta" cells={["Todo o período"]}>
        <div className="cells-4">
          <SummaryCell label="Links" value={summary?.links} first />
          <SummaryCell label="Cliques totais" value={summary?.clicks} />
          <SummaryCell label="Cliques únicos" value={summary?.unique} />
          <SummaryCell label="Fora do ar" value={summary?.down} />
        </div>
      </Plate>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 280, maxWidth: 420 }}>
          <label className="sr-only" htmlFor="search">
            Buscar por código ou URL de destino
          </label>
          <Search
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-disabled)",
              pointerEvents: "none",
            }}
          />
          <input
            id="search"
            className="input"
            type="search"
            placeholder="Buscar por código ou URL de destino"
            value={search}
            style={{ paddingLeft: 34, minHeight: 38 }}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="seg" role="radiogroup" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map(([value, label]) => (
            <label className="seg-opt" key={value}>
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => {
                  setStatus(value);
                  setPage(1);
                }}
              />
              {label}
            </label>
          ))}
        </div>

        <Link className="btn btn-ghost" to="/painel">
          Ver como tabela
        </Link>

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          onClick={() => setCreating(true)}
        >
          Novo link
        </button>
      </div>

      {error ? (
        <Plate>
          <div className="stack" style={{ padding: "56px 20px", gap: 12, alignItems: "center" }}>
            <p className="kicker">{error.status ? `HTTP ${error.status}` : "Sem resposta"}</p>
            <h3 style={{ fontSize: 22 }}>Não foi possível carregar</h3>
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Tentar de novo
            </button>
          </div>
        </Plate>
      ) : cards.length === 0 && !loading ? (
        <Plate>
          <div className="stack" style={{ padding: "56px 20px", gap: 12, alignItems: "center" }}>
            <h3 style={{ fontSize: 22 }}>
              {term ? `Nada encontrado para “${term}”` : "Nenhum link ainda"}
            </h3>
            <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-small)" }}>
              {term
                ? "Nenhum código ou destino corresponde a esta busca."
                : "Encurte a primeira URL para começar a acompanhar os cliques."}
            </p>
          </div>
        </Plate>
      ) : (
        <div className="grid grid-3">
          {cards.map((link) => (
            <Card key={link.id} link={link} onChanged={() => void load()} onQr={setQrCode} />
          ))}
        </div>
      )}

      <QrDialog open={!!qrCode} shortCode={qrCode} onClose={() => setQrCode(null)} />

      <NewLinkDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          setCreating(false);
          setPage(1);
          await load();
        }}
      />

      {remaining > 0 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 38 }}
            disabled={loading}
            onClick={() => setPage(page + 1)}
          >
            {loading ? "Carregando…" : `Carregar mais (${formatNumber(remaining)} restantes)`}
          </button>
        </div>
      )}
    </main>
  );
}

function SummaryCell({
  label,
  value,
  first,
}: {
  label: string;
  value?: number;
  first?: boolean;
}) {
  return (
    <div
      className="stack"
      style={{
        padding: "16px 20px",
        gap: 6,
        borderLeft: first ? undefined : "1px solid var(--color-divider)",
      }}
    >
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
        {label}
      </span>
      <span
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 32,
          lineHeight: "36px",
          letterSpacing: ".02em",
          color: value == null ? "var(--ink-disabled)" : undefined,
        }}
      >
        {value == null ? "—" : formatNumber(value)}
      </span>
    </div>
  );
}

function Card({
  link,
  onChanged,
  onQr,
}: {
  link: LinkListItem;
  onChanged: () => void;
  onQr: (code: string) => void;
}) {
  const state = linkState(link);
  const faded = state === "inactive";
  const dataInk = faded ? "var(--ink-disabled)" : undefined;

  return (
    <Plate as="article">
      <div className="stack" style={{ padding: 20, gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <Link
            to={`/links/${link.short_code}`}
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 24,
              lineHeight: "28px",
              letterSpacing: ".02em",
              color: dataInk,
            }}
          >
            {link.short_code}
          </Link>
          <StateTag state={state} />
        </div>

        <p
          className="break"
          style={{
            fontSize: 13,
            lineHeight: "20px",
            color: faded ? "var(--ink-disabled)" : "var(--ink-small)",
          }}
        >
          {link.original_url}
        </p>

        <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          {link.max_clicks ? <Progress link={link} /> : <Columns link={link} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Actions link={link} state={state} onChanged={onChanged} onQr={onQr} />
        </div>
      </div>
    </Plate>
  );
}

/** Sem max_clicks: três colunas, com `—` no lugar do limite. */
function Columns({ link }: { link: LinkListItem }) {
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <Stat label="Cliques" value={formatNumber(link.total_clicks)} />
      <Stat label="Únicos" value={formatNumber(link.unique_clicks)} />
      <Stat label="Limite" value="—" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--ink-meta)",
        }}
      >
        {label}
      </span>
      <span
        className="tnum"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: 22,
          lineHeight: "26px",
          letterSpacing: ".02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Com max_clicks: razão + barra de 6px, e a data de expiração quando existe. */
function Progress({ link }: { link: LinkListItem }) {
  const ratio = Math.min(1, link.unique_clicks / link.max_clicks);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        className="tnum"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--ink-small)",
        }}
      >
        <span>Cliques únicos</span>
        <span>
          {formatNumber(link.unique_clicks)} / {formatNumber(link.max_clicks)}
        </span>
      </div>
      <div
        style={{ height: 6, background: "color-mix(in srgb, var(--color-text) 10%, transparent)" }}
        aria-hidden="true"
      >
        <div style={{ height: "100%", width: `${ratio * 100}%`, background: "var(--color-accent)" }} />
      </div>
      {link.expires_at && (
        <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--ink-small)" }}>
          Expira em {formatDateShort(link.expires_at)}
        </span>
      )}
    </div>
  );
}

function Actions({
  link,
  state,
  onChanged,
  onQr,
}: {
  link: LinkListItem;
  state: ReturnType<typeof linkState>;
  onChanged: () => void;
  onQr: (code: string) => void;
}) {
  const small = { fontSize: 13, padding: "5px 10px", height: "auto" } as const;

  if (state === "inactive") {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        style={small}
        onClick={async () => {
          await linkApi.setActive(link.short_code, true);
          onChanged();
        }}
      >
        Ativar
      </button>
    );
  }

  return (
    <>
      {state === "max_clicks" ? (
        <button
          type="button"
          className="btn btn-secondary"
          style={small}
          onClick={() => navigate(`/links/${link.short_code}`)}
        >
          Aumentar limite
        </button>
      ) : (
        <>
          <SmallAction
            label="Copiar"
            onClick={() => void navigator.clipboard?.writeText(link.short_url)}
          >
            <Copy size={15} strokeWidth={1.5} />
          </SmallAction>
          <SmallAction label="QR" onClick={() => onQr(link.short_code)}>
            <QrCode size={15} strokeWidth={1.5} />
          </SmallAction>
        </>
      )}
      <Link
        className="btn btn-ghost"
        to={`/links/${link.short_code}`}
        style={{ marginLeft: "auto", fontSize: 13 }}
      >
        Estatísticas
      </Link>
    </>
  );
}

function SmallAction({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      title={label}
      style={{ fontSize: 13, padding: "5px 10px", height: "auto" }}
      onClick={onClick}
    >
      {children}
      {label}
    </button>
  );
}
