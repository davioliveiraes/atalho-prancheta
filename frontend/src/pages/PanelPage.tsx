import { Copy, Pencil, Power, QrCode, Search, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { NewLinkDialog } from "../components/NewLinkDialog";
import { QrDialog } from "../components/QrDialog";
import { StateTag } from "../components/elements";
import { Plate } from "../components/Plate";
import { ApiError, linkApi } from "../lib/api";
import { formatDateShort, formatNumber, linkState } from "../lib/format";
import { useRegisterMobileBar } from "../lib/mobileBar";
import { useIsMobile } from "../lib/useIsMobile";
import { Link, navigate } from "../lib/router";
import type { LinkListItem, LinkState, Paginated } from "../types";

const PAGE_SIZE = 10;

type StatusFilter = "all" | "active" | "inactive";

/** `Todos` omite o parâmetro; os outros mapeiam para ?is_active=. */
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

export function PanelPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<LinkListItem> | null>(null);
  const [summary, setSummary] = useState<{ links: number; clicks: number } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const mobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);

  // Callbacks estáveis: a nav registra a barra do mobile por identidade.
  const openSearch = useCallback(() => setSearchOpen((value) => !value), []);
  const openNew = useCallback(() => setCreating(true), []);
  useRegisterMobileBar(
    mobile ? { title: "Painel", onSearch: openSearch, onNew: openNew } : null,
  );

  // Debounce de 300ms: uma requisição por pausa de digitação, não por tecla.
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
      const [list, totals] = await Promise.all([
        linkApi.list({ ...params, page }),
        linkApi.summary(params),
      ]);
      setData(list);
      setSummary(totals);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setLoading(false);
    }
  }, [term, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.results ?? [];
  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <main
      className="shell stack"
      style={{
        paddingTop: mobile ? 20 : 40,
        paddingBottom: mobile ? 32 : 56,
        gap: mobile ? 20 : 28,
      }}
    >
      <header style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <p className="kicker">01 · Seus links</p>
          <hr className="rule" />
          <h2 style={{ fontSize: 34, lineHeight: "36px" }}>
            {summary ? (
              <span className="tnum">
                {formatNumber(summary.links)} links · {formatNumber(summary.clicks)} cliques
              </span>
            ) : (
              <span className="muted">—</span>
            )}
          </h2>
        </div>
        {!mobile && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Novo link
          </button>
        )}
      </header>

      {/* 1h: a busca vive atrás do botão da nav e abre num campo de 48px. */}
      {mobile && searchOpen && (
        <div style={{ position: "relative" }}>
          <label className="sr-only" htmlFor="search-mobile">
            Buscar por código ou URL de destino
          </label>
          <input
            id="search-mobile"
            className="input"
            type="search"
            autoFocus
            placeholder="Buscar por código ou URL de destino"
            value={search}
            style={{ height: 48, minHeight: 48 }}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 280,
            maxWidth: 420,
            display: mobile ? "none" : undefined,
          }}
        >
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

        {!mobile && (
          <Link className="btn btn-ghost" to="/painel/fichas">
            Ver como fichas
          </Link>
        )}

        {!mobile && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 13,
              lineHeight: "20px",
              color: "var(--ink-meta)",
            }}
          >
            Ordenado por criação · mais recentes
          </span>
        )}
      </div>

      <Plate
        title="Links encurtados"
        cells={[`count ${formatNumber(total)}`, `Página ${page} de ${pages}`]}
        footer={
          items.length > 0 && (
            <>
              <span className="tnum" style={{ fontSize: 13, color: "var(--ink-small)" }}>
                Mostrando {first}–{last} de {formatNumber(total)}
              </span>
              <span className="spacer" />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={
                    mobile
                      ? { fontSize: 13, padding: "5px 12px", height: 44 }
                      : { fontSize: 13, padding: "5px 12px", height: "auto" }
                  }
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={
                    mobile
                      ? { fontSize: 13, padding: "5px 12px", height: 44 }
                      : { fontSize: 13, padding: "5px 12px", height: "auto" }
                  }
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </>
          )
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={() => void load()} />
        ) : loading ? (
          <Skeleton />
        ) : items.length === 0 ? (
          term ? (
            <EmptyState
              title={`Nada encontrado para “${term}”`}
              text="Nenhum código ou destino corresponde a esta busca."
              action={
                <button type="button" className="btn btn-ghost" onClick={() => setSearch("")}>
                  Limpar busca
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Nenhum link ainda"
              text="Encurte a primeira URL para começar a acompanhar os cliques."
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCreating(true)}
                >
                  Criar o primeiro link
                </button>
              }
            />
          )
        ) : mobile ? (
          <div className="stack">
            {items.map((item) => (
              <MobileCard key={item.id} item={item} onChanged={load} onQr={setQrCode} />
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 150 }} />
                <col />
                <col style={{ width: 112 }} />
                <col style={{ width: 112 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Destino</th>
                  <th className="num">Cliques</th>
                  <th className="num">Únicos</th>
                  <th>Status</th>
                  <th>Criado</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Row key={item.id} item={item} onChanged={load} onQr={setQrCode} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Plate>

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
    </main>
  );
}

/**
 * 1h — cada linha da tabela vira uma ficha. `.table` não cabe em 390px.
 * Com `max_clicks` definido a ficha mostra o medidor; sem ele, os números.
 */
function MobileCard({
  item,
  onChanged,
  onQr,
}: {
  item: LinkListItem;
  onChanged: () => Promise<void>;
  onQr: (code: string) => void;
}) {
  const state = linkState(item);
  const faded = state === "inactive";
  const ink = faded ? "var(--ink-disabled)" : undefined;

  return (
    <article
      className="stack"
      style={{
        padding: 16,
        gap: 12,
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <Link
          to={`/links/${item.short_code}`}
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 22,
            lineHeight: "26px",
            letterSpacing: ".02em",
            color: ink,
          }}
        >
          {item.short_code}
        </Link>
        <StateTag state={state} />
      </div>

      <p className="break" style={{ fontSize: 13, lineHeight: "19px", color: faded ? "var(--ink-disabled)" : "var(--ink-small)" }}>
        {item.original_url}
      </p>

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
        {item.max_clicks ? (
          <div className="stack" style={{ gap: 8 }}>
            <div
              className="tnum"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "var(--ink-small)",
              }}
            >
              <span>Únicos</span>
              <span>
                {formatNumber(item.unique_clicks)} / {formatNumber(item.max_clicks)}
              </span>
            </div>
            <div style={{ height: 6, background: "color-mix(in srgb, var(--color-text) 10%, transparent)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(1, item.unique_clicks / item.max_clicks) * 100}%`,
                  background: "var(--color-accent)",
                }}
              />
            </div>
          </div>
        ) : (
          <p className="tnum" style={{ fontSize: 13, color: ink }}>
            {formatNumber(item.total_clicks)} cliques{" "}
            <span style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
              · {formatNumber(item.unique_clicks)} únicos
            </span>
          </p>
        )}
      </div>

      {/* Alvos de 44px: nada de ícones de 16px com 2px de gap. */}
      {state === "inactive" ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ height: 44 }}
          onClick={async () => {
            await linkApi.setActive(item.short_code, true);
            await onChanged();
          }}
        >
          Ativar
        </button>
      ) : (
        <div className="split-mobile" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 44 }}
            onClick={() => void navigator.clipboard?.writeText(item.short_url)}
          >
            <Copy size={16} strokeWidth={1.5} />
            Copiar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 44 }}
            onClick={() => onQr(item.short_code)}
          >
            <QrCode size={16} strokeWidth={1.5} />
            QR
          </button>
        </div>
      )}
    </article>
  );
}

function Row({
  item,
  onChanged,
  onQr,
}: {
  item: LinkListItem;
  onChanged: () => Promise<void>;
  onQr: (code: string) => void;
}) {
  const state = linkState(item);

  return (
    <tr data-inactive={state === "inactive"}>
      <td>
        <Link
          to={`/links/${item.short_code}`}
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 17,
            letterSpacing: ".02em",
            textDecoration: "none",
          }}
        >
          {item.short_code}
        </Link>
      </td>
      <td style={{ color: "var(--ink-secondary)" }}>
        <span className="truncate" title={item.original_url}>
          {item.original_url}
        </span>
      </td>
      <td className="num">{formatNumber(item.total_clicks)}</td>
      <td className="num">{formatNumber(item.unique_clicks)}</td>
      <td>
        <StateTag state={state} />
      </td>
      <td className="tnum" style={{ fontSize: 13, whiteSpace: "nowrap", color: "var(--ink-meta)" }}>
        {formatDateShort(item.created_at)}
      </td>
      <td>
        <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <RowActions item={item} state={state} onChanged={onChanged} onQr={onQr} />
        </div>
      </td>
    </tr>
  );
}

/** O conjunto de ações muda com o estado do link. */
function RowActions({
  item,
  state,
  onChanged,
  onQr,
}: {
  item: LinkListItem;
  state: LinkState;
  onChanged: () => Promise<void>;
  onQr: (code: string) => void;
}) {
  const copy = (
    <IconAction
      key="copy"
      label="Copiar"
      onClick={() => void navigator.clipboard?.writeText(item.short_url)}
    >
      <Copy size={16} strokeWidth={1.5} />
    </IconAction>
  );

  const qr = (
    <IconAction key="qr" label="QR Code" onClick={() => onQr(item.short_code)}>
      <QrCode size={16} strokeWidth={1.5} />
    </IconAction>
  );

  const edit = (
    <IconAction key="edit" label="Editar" to={`/links/${item.short_code}`}>
      <Pencil size={16} strokeWidth={1.5} />
    </IconAction>
  );

  const deactivate = (
    <IconAction
      key="power"
      label="Desativar"
      onClick={async () => {
        await linkApi.setActive(item.short_code, false);
        await onChanged();
      }}
    >
      <Power size={16} strokeWidth={1.5} />
    </IconAction>
  );

  const remove = (
    <IconAction
      key="trash"
      label="Excluir"
      onClick={async () => {
        if (!window.confirm(`Excluir o link ${item.short_code}? A ação não pode ser desfeita.`)) {
          return;
        }
        await linkApi.remove(item.short_code);
        await onChanged();
      }}
    >
      <Trash2 size={16} strokeWidth={1.5} />
    </IconAction>
  );

  if (state === "inactive") {
    return (
      <>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: 13, padding: "5px 10px", height: "auto" }}
          onClick={async () => {
            await linkApi.setActive(item.short_code, true);
            await onChanged();
          }}
        >
          Ativar
        </button>
        {remove}
      </>
    );
  }

  if (state === "expired") return <>{[copy, edit, remove]}</>;
  if (state === "max_clicks") return <>{[copy, qr, edit]}</>;
  return <>{[copy, qr, deactivate]}</>;
}

/** Ação de ícone: sempre com aria-label e title. */
function IconAction({
  label,
  children,
  to,
  onClick,
}: {
  label: string;
  children: ReactNode;
  to?: string;
  onClick?: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className="btn btn-icon btn-ghost"
      aria-label={label}
      title={label}
      onClick={() => (to ? navigate(to) : void onClick?.())}
    >
      {children}
    </button>
  );
}

/** Carregando: 5 linhas de esqueleto, sem spinner. */
function Skeleton() {
  const widths = ["60%", "85%", "40%", "72%", "55%"];
  return (
    <div className="stack" style={{ padding: "14px 20px", gap: 22 }}>
      {widths.map((width, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key -- linhas posicionais
          key={index}
          style={{ display: "flex", gap: 20, alignItems: "center" }}
        >
          <Bar width={90} />
          <Bar width={width} />
          <Bar width={48} />
          <Bar width={48} />
          <Bar width={110} />
        </div>
      ))}
    </div>
  );
}

function Bar({ width }: { width: number | string }) {
  return (
    <span
      style={{
        display: "block",
        width,
        height: 12,
        background: "color-mix(in srgb, var(--color-text) 10%, transparent)",
      }}
    />
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div
      className="stack"
      style={{ padding: "56px 20px", gap: 12, alignItems: "center", textAlign: "center" }}
    >
      <h3 style={{ fontSize: 22 }}>{title}</h3>
      <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-small)", maxWidth: "48ch" }}>
        {text}
      </p>
      <div style={{ marginTop: 12 }}>{action}</div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className="stack" style={{ padding: "56px 20px", gap: 12, alignItems: "center" }}>
      <p className="kicker">{error.status ? `HTTP ${error.status}` : "Sem resposta"}</p>
      <h3 style={{ fontSize: 22 }}>Não foi possível carregar</h3>
      <div style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
