import type { ClickRecord, LinkState, LinkStatistics, LinkStatus } from "../types";

const NUMBER = new Intl.NumberFormat("pt-BR");

export function formatNumber(value: number) {
  return NUMBER.format(value);
}

/** `dd/mm/aaaa · hh:mm` — ausência é travessão, nunca "null". */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()} · ${hours}:${minutes}`;
}

/** Formato curto para listas: `01/12 · 10:16`. */
export function formatDateShort(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Ano de dois dígitos, para as células de estatística: `31/12/25`. */
export function formatDateCompact(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear() % 100)}`;
}

/** Valor para o atributo `value` de um `<input type="datetime-local">`. */
export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Estado visível do link, na mesma precedência de `can_be_accessed()`:
 * inativo, depois expirado, depois limite atingido.
 *
 * Lista e detalhe trazem expires_at, então a distinção sai do dado — não de
 * casar a mensagem de `status` por texto. `statistics`, quando existe, é a
 * palavra final porque vem calculada pelo servidor.
 */
export function linkState(
  input: {
    is_active: boolean;
    status: LinkStatus;
    expires_at?: string | null;
  },
  statistics?: LinkStatistics,
): LinkState {
  if (!input.is_active) return "inactive";
  if (input.status.can_access) return "active";

  const expired =
    statistics?.is_expired ??
    (input.expires_at ? new Date(input.expires_at).getTime() <= Date.now() : false);

  return expired ? "expired" : "max_clicks";
}

export const STATE_LABEL: Record<LinkState, string> = {
  active: "Ativo",
  inactive: "Inativo",
  expired: "Expirado",
  max_clicks: "Limite atingido",
};

export const STATE_TAG_CLASS: Record<LinkState, string> = {
  active: "tag tag-accent",
  inactive: "tag tag-neutral",
  expired: "tag tag-outline",
  max_clicks: "tag tag-outline",
};

/**
 * Agregação derivada de `recent_clicks[].clicked_at` — a API não expõe série
 * temporal, então esta contagem é calculada no cliente e rotulada como tal.
 */
export function clicksByDay(clicks: ClickRecord[], days = 7) {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const keys: { key: string; label: string }[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    keys.push({ key, label: String(date.getDate()).padStart(2, "0") });
    buckets.set(key, 0);
  }

  for (const click of clicks) {
    const date = new Date(click.clicked_at);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return keys.map(({ key, label }) => ({ label, value: buckets.get(key) ?? 0 }));
}
