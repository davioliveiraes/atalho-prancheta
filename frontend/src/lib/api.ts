import type {
  CreateLinkPayload,
  LinkDetail,
  LinkListItem,
  LinkStatisticsResponse,
  Paginated,
  QrCodeResponse,
  UpdateLinkPayload,
} from "../types";

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

/**
 * Erro da API. `fields` preserva o mapa de validação do DRF para que a tela
 * mostre o texto literal devolvido pelo backend, campo a campo.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Primeira mensagem de um campo, ou undefined. */
  field(name: string): string | undefined {
    return this.fields[name]?.[0];
  }
}

function parseErrorBody(body: unknown): { message: string; fields: Record<string, string[]> } {
  if (!body || typeof body !== "object") {
    return { message: "", fields: {} };
  }

  const record = body as Record<string, unknown>;
  const fields: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      fields[key] = value.map(String);
    } else if (typeof value === "string") {
      fields[key] = [value];
    }
  }

  // `detail` e `error` são as chaves de mensagem única usadas pelo backend.
  const single = fields.detail?.[0] ?? fields.error?.[0];
  const first = Object.values(fields)[0]?.[0];

  return { message: single ?? first ?? "", fields };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const { message, fields } = parseErrorBody(body);
    throw new ApiError(
      message || "Não foi possível concluir a operação.",
      response.status,
      fields,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface ListParams {
  search?: string;
  isActive?: boolean | null;
  page?: number;
}

/** Somas do que a API devolve — nenhuma média, projeção ou comparação. */
export interface LinkSummary {
  links: number;
  clicks: number;
  unique: number;
  down: number;
}

export const linkApi = {
  /** GET /api/urls/?search=&is_active=&page= */
  list({ search, isActive, page }: ListParams = {}): Promise<Paginated<LinkListItem>> {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (isActive != null) query.set("is_active", String(isActive));
    if (page && page > 1) query.set("page", String(page));
    const suffix = query.toString() ? `?${query}` : "";
    return request<Paginated<LinkListItem>>(`/urls/${suffix}`);
  },

  /**
   * Resumo do cabeçalho do painel: total de links e soma de cliques.
   * A API pagina de 10 em 10 e não expõe agregado, então percorremos as
   * páginas do filtro atual. O teto evita varredura sem fim se a lista crescer.
   */
  async summary(params: ListParams = {}): Promise<LinkSummary> {
    const MAX_PAGES = 50;
    let page = 1;
    let links = 0;
    let clicks = 0;
    let unique = 0;
    let down = 0;

    for (;;) {
      const data = await linkApi.list({ ...params, page });
      links = data.count;
      for (const item of data.results) {
        clicks += item.total_clicks;
        unique += item.unique_clicks;
        // Fora do ar cobre inativo, expirado e limite atingido de uma vez.
        if (!item.status.can_access) down += 1;
      }
      if (!data.next || page >= MAX_PAGES) break;
      page += 1;
    }

    return { links, clicks, unique, down };
  },

  /** GET /api/urls/{code}/ */
  detail(shortCode: string): Promise<LinkDetail> {
    return request<LinkDetail>(`/urls/${shortCode}/`);
  },

  /** GET /api/urls/{code}/statistics/ */
  statistics(shortCode: string): Promise<LinkStatisticsResponse> {
    return request<LinkStatisticsResponse>(`/urls/${shortCode}/statistics/`);
  },

  /** GET /api/urls/{code}/qrcode/ */
  qrcode(shortCode: string): Promise<QrCodeResponse> {
    return request<QrCodeResponse>(`/urls/${shortCode}/qrcode/`);
  },

  /** POST /api/urls/ — 201 devolve o serializador de detalhe */
  create(payload: CreateLinkPayload): Promise<LinkDetail> {
    return request<LinkDetail>("/urls/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /** PATCH /api/urls/{code}/ */
  update(shortCode: string, payload: UpdateLinkPayload): Promise<LinkDetail> {
    return request<LinkDetail>(`/urls/${shortCode}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /** POST /api/urls/{code}/activate|deactivate/ */
  setActive(shortCode: string, active: boolean): Promise<{ message: string; data: LinkDetail }> {
    return request<{ message: string; data: LinkDetail }>(
      `/urls/${shortCode}/${active ? "activate" : "deactivate"}/`,
      { method: "POST" },
    );
  },

  /** DELETE /api/urls/{code}/ */
  remove(shortCode: string): Promise<void> {
    return request<void>(`/urls/${shortCode}/`, { method: "DELETE" });
  },
};

/** Endereço do redirect real do backend, que contabiliza o clique. */
export function redirectUrl(shortCode: string) {
  return `${API_ROOT}/r/${shortCode}/`;
}
