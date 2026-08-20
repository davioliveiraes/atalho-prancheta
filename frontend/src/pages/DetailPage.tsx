import { Copy, Download, Power, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { Dialog } from "../components/Dialog";
import { Plate } from "../components/Plate";
import { ErrorLine, StateTag } from "../components/elements";
import { ApiError, linkApi } from "../lib/api";
import {
  STATE_LABEL,
  clicksByDay,
  formatDate,
  formatDateCompact,
  formatDateShort,
  formatDateTime,
  formatNumber,
  linkState,
  toDateTimeLocal,
} from "../lib/format";
import { Link, navigate } from "../lib/router";
import type { LinkDetail, LinkStatisticsResponse } from "../types";

const WINDOWS = [7, 14, 30] as const;

export function DetailPage({ shortCode }: { shortCode: string }) {
  const [detail, setDetail] = useState<LinkDetail | null>(null);
  const [stats, setStats] = useState<LinkStatisticsResponse | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [days, setDays] = useState<number>(14);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `statistics` traz os 20 cliques; o detalhe traz short_url, status e
      // updated_at, que o endpoint de estatísticas não devolve.
      const [detailData, statsData] = await Promise.all([
        linkApi.detail(shortCode),
        linkApi.statistics(shortCode),
      ]);
      setDetail(detailData);
      setStats(statsData);
      const qr = await linkApi.qrcode(shortCode).catch(() => null);
      setQrUrl(qr?.qr_code_url ?? detailData.qr_code);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setLoading(false);
    }
  }, [shortCode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !detail) {
    return (
      <main className="shell" style={{ paddingTop: 32, paddingBottom: 56 }}>
        <p className="small">Carregando…</p>
      </main>
    );
  }

  if (!detail || !stats) {
    return (
      <main className="shell stack" style={{ paddingTop: 32, paddingBottom: 56, gap: 24 }}>
        <p className="kicker">{error?.status ? `HTTP ${error.status}` : "Erro"}</p>
        <h2 style={{ fontSize: 34 }}>{error?.message ?? "Link não encontrado"}</h2>
        <div>
          <Link className="btn btn-secondary" to="/painel">
            Voltar ao painel
          </Link>
        </div>
      </main>
    );
  }

  const state = linkState(detail, detail.statistics);
  const series = clicksByDay(stats.recent_clicks, days);
  const peak = Math.max(1, ...series.map((point) => point.value));

  return (
    <main className="shell stack" style={{ paddingTop: 32, paddingBottom: 56, gap: 28 }}>
      <nav
        aria-label="Trilha"
        style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-meta)" }}
      >
        <Link to="/painel">Painel</Link>
        <span style={{ padding: "0 8px" }}>/</span>
        <span>{detail.short_code}</span>
      </nav>

      <header style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <h2 className="break" style={{ fontSize: 44, lineHeight: "46px" }}>
            {detail.short_url}
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <StateTag state={state} />
            <span
              className="break"
              style={{ fontSize: 14, lineHeight: "22px", color: "var(--ink-secondary)" }}
            >
              → {detail.original_url}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 38 }}
            onClick={() => void navigator.clipboard?.writeText(detail.short_url)}
          >
            <Copy size={15} strokeWidth={1.5} />
            Copiar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 38 }}
            onClick={async () => {
              await linkApi.setActive(detail.short_code, !detail.is_active);
              await load();
            }}
          >
            <Power size={15} strokeWidth={1.5} />
            {detail.is_active ? "Desativar" : "Ativar"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 38 }}
            onClick={() => setEditing(true)}
          >
            Editar link
          </button>
        </div>
      </header>

      <div className="grid grid-8-4" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 28 }}>
          <Plate title="Estatísticas" cells={[`Criado ${formatDate(detail.created_at)}`]}>
            <div className="cells-4">
              <StatCell label="Cliques totais" value={formatNumber(detail.total_clicks)} first />
              <StatCell label="Cliques únicos" value={formatNumber(detail.unique_clicks)} />
              <StatCell
                label="Limite de únicos"
                value={
                  detail.max_clicks
                    ? `${formatNumber(detail.unique_clicks)} / ${formatNumber(detail.max_clicks)}`
                    : "—"
                }
                empty={!detail.max_clicks}
              />
              <StatCell
                label="Expira em"
                value={formatDateCompact(detail.expires_at)}
                empty={!detail.expires_at}
              />
            </div>
          </Plate>

          <Plate
            title="Cliques por dia"
            cells={[`Últimos ${days} dias`]}
            footer={
              <span style={{ fontSize: 13, lineHeight: "20px", color: "var(--ink-small)" }}>
                Série derivada de <code>recent_clicks[].clicked_at</code> — o gráfico não é um campo
                da API, é agregação no cliente.
              </span>
            }
          >
            <div style={{ padding: "24px 20px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180 }}>
                {series.map((point) => (
                  <div
                    key={point.label}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 8,
                      height: "100%",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: "100%",
                        height: (point.value / peak) * 132,
                        background: "var(--color-accent)",
                      }}
                    />
                    <span
                      className="tnum"
                      style={{
                        fontSize: 11,
                        letterSpacing: ".04em",
                        color: "var(--ink-disabled)",
                      }}
                    >
                      {point.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="seg" role="radiogroup" aria-label="Janela do gráfico" style={{ marginTop: 16 }}>
                {WINDOWS.map((value) => (
                  <label className="seg-opt" key={value} style={{ height: 30, fontSize: 12 }}>
                    <input
                      type="radio"
                      name="window"
                      checked={days === value}
                      onChange={() => setDays(value)}
                    />
                    {value} dias
                  </label>
                ))}
              </div>
            </div>
          </Plate>

          <Plate title="Cliques recentes" cells={["Últimos 20"]}>
            {stats.recent_clicks.length === 0 ? (
              <p style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-small)" }}>
                Nenhum clique registrado até agora.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="table" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 140 }} />
                    <col />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 150 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>IP</th>
                      <th className="hide-mobile">User agent</th>
                      <th className="hide-mobile">Referência</th>
                      <th>Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_clicks.map((click) => (
                      <tr key={click.id}>
                        <td style={{ padding: "12px 20px" }}>
                          <span className="tnum">{click.ip_address}</span>
                          {/* 1h: user agent e referência descem para cá a 70%. */}
                          <span
                            className="show-mobile"
                            title={`${click.user_agent || "—"} · ${click.referer || "—"}`}
                          >
                            {click.user_agent || "—"} · {click.referer || "—"}
                          </span>
                        </td>
                        <td className="hide-mobile" style={{ padding: "12px 20px", color: "var(--ink-secondary)" }}>
                          <span className="truncate" title={click.user_agent}>
                            {click.user_agent || "—"}
                          </span>
                        </td>
                        <td className="hide-mobile" style={{ padding: "12px 20px", color: "var(--ink-secondary)" }}>
                          {click.referer ? (
                            <span className="truncate" title={click.referer}>
                              {click.referer}
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-disabled)" }}>—</span>
                          )}
                        </td>
                        <td
                          className="tnum"
                          style={{
                            padding: "12px 20px",
                            whiteSpace: "nowrap",
                            color: "var(--ink-meta)",
                          }}
                        >
                          {formatDateShort(click.clicked_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Plate>
        </div>

        <div className="stack" style={{ gap: 28 }}>
          <Plate>
            <div className="stack" style={{ padding: 20, gap: 16 }}>
              <BlockTitle>QR Code</BlockTitle>
              <div
                style={{
                  border: "1px solid var(--color-divider)",
                  aspectRatio: "1",
                  padding: 16,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {qrUrl ? (
                  <img src={qrUrl} alt={`QR Code do link ${detail.short_code}`} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--ink-disabled)" }}>—</span>
                )}
              </div>
              <a
                className="btn btn-secondary btn-block"
                style={{ height: 38 }}
                href={qrUrl ?? undefined}
                download={`${detail.short_code}.png`}
                aria-disabled={qrUrl ? undefined : true}
              >
                <Download size={15} strokeWidth={1.5} />
                Baixar PNG
              </a>
            </div>
          </Plate>

          <Plate>
            <div className="stack" style={{ padding: 20, gap: 16 }}>
              <BlockTitle>Configuração</BlockTitle>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "10px 16px",
                  fontSize: 14,
                  margin: 0,
                }}
              >
                <Term label="Código">
                  {detail.short_code}{" "}
                  <span style={{ fontSize: 12, color: "var(--ink-disabled)" }}>(imutável)</span>
                </Term>
                <Term label="Status">{STATE_LABEL[state]}</Term>
                <Term label="Expira em">{formatDateTime(detail.expires_at)}</Term>
                <Term label="Máx. únicos">
                  {detail.max_clicks ? formatNumber(detail.max_clicks) : "—"}
                </Term>
                <Term label="Atualizado">{formatDateTime(detail.updated_at)}</Term>
              </dl>

              <hr className="rule" />

              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  color: "var(--color-accent-800)",
                  justifyContent: "flex-start",
                  paddingInline: 0,
                }}
                onClick={() => setConfirming(true)}
              >
                <Trash2 size={15} strokeWidth={1.5} />
                Excluir link e cliques
              </button>
            </div>
          </Plate>
        </div>
      </div>

      <EditDialog
        open={editing}
        link={detail}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await load();
        }}
      />

      <Dialog
        open={confirming}
        title="Excluir link"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 38 }}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 38 }}
              onClick={async () => {
                await linkApi.remove(detail.short_code);
                navigate("/painel");
              }}
            >
              <Trash2 size={15} strokeWidth={1.5} />
              Excluir link e cliques
            </button>
          </>
        }
      >
        <div className="dialog-body">
          <p style={{ fontSize: 15, lineHeight: "24px", color: "var(--ink-secondary)" }}>
            Excluir <strong>{detail.short_code}</strong> apaga também os{" "}
            {formatNumber(detail.total_clicks)} cliques registrados. A ação não pode ser desfeita.
          </p>
        </div>
      </Dialog>
    </main>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-heading)",
        fontWeight: 600,
        fontSize: 13,
        letterSpacing: ".08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function StatCell({
  label,
  value,
  first,
  empty,
}: {
  label: string;
  value: string;
  first?: boolean;
  empty?: boolean;
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
          fontSize: 36,
          lineHeight: "40px",
          letterSpacing: ".02em",
          color: empty ? "var(--ink-disabled)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt style={{ color: "var(--ink-meta)", whiteSpace: "nowrap" }}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0 }}>{children}</dd>
    </>
  );
}

function EditDialog({
  open,
  link,
  onClose,
  onSaved,
}: {
  open: boolean;
  link: LinkDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [originalUrl, setOriginalUrl] = useState(link.original_url);
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(link.expires_at));
  const [maxClicks, setMaxClicks] = useState(String(link.max_clicks || ""));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOriginalUrl(link.original_url);
    setExpiresAt(toDateTimeLocal(link.expires_at));
    setMaxClicks(String(link.max_clicks || ""));
    setError(null);
  }, [open, link]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await linkApi.update(link.short_code, {
        original_url: originalUrl,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_clicks: maxClicks ? Number(maxClicks) : 0,
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Falha de rede.", 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Editar link"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" style={{ height: 38 }} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            form="edit-link-form"
            style={{ height: 38 }}
            disabled={busy}
          >
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <form id="edit-link-form" className="dialog-body" onSubmit={submit}>
        <div className="field">
          <label htmlFor="edit-url">Destino</label>
          <input
            id="edit-url"
            className="input"
            type="url"
            required
            value={originalUrl}
            aria-invalid={error?.field("original_url") ? true : undefined}
            onChange={(event) => setOriginalUrl(event.target.value)}
          />
          {error?.field("original_url") && <ErrorLine>{error.field("original_url")}</ErrorLine>}
        </div>

        <div className="field">
          <label htmlFor="edit-expires">Expira em</label>
          <input
            id="edit-expires"
            className="input"
            type="datetime-local"
            value={expiresAt}
            aria-invalid={error?.field("expires_at") ? true : undefined}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
          {error?.field("expires_at") ? (
            <ErrorLine>{error.field("expires_at")}</ErrorLine>
          ) : (
            <span className="field-hint">Vazio mantém o link sem data de expiração.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="edit-max">Máximo de cliques únicos</label>
          <input
            id="edit-max"
            className="input tnum"
            type="number"
            min={1}
            placeholder="Ilimitado"
            value={maxClicks}
            aria-invalid={error?.field("max_clicks") ? true : undefined}
            onChange={(event) => setMaxClicks(event.target.value)}
          />
          {error?.field("max_clicks") && <ErrorLine>{error.field("max_clicks")}</ErrorLine>}
        </div>

        {error && !Object.keys(error.fields).length && <ErrorLine>{error.message}</ErrorLine>}
      </form>
    </Dialog>
  );
}
