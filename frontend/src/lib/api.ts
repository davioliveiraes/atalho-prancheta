import { clearSession, getSession, setTokens } from "./session";
import type {
  AuthSession,
  AuthUser,
  CreateLinkPayload,
  LinkDetail,
  LinkListItem,
  LinkStatisticsResponse,
  LoginPayload,
  Paginated,
  QrCodeResponse,
  RegisterPayload,
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

  /**
   * Todas as mensagens de um campo. Os validadores de senha do Django
   * respondem várias de uma vez ("muito comum" e "inteiramente numérica"), e
   * mostrar só a primeira faria o usuário corrigir uma de cada vez.
   */
  list(name: string): string[] {
    return this.fields[name] ?? [];
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

interface RequestOptions extends RequestInit {
  /**
   * Não manda token nem tenta renovar em caso de 401. É o que as próprias
   * rotas de conta usam — entrar, cadastrar e renovar não dependem de sessão,
   * e deixar a renovação tentar se renovar seria uma volta sem fim.
   */
  anonymous?: boolean;
}

function send(path: string, options: RequestOptions) {
  const { anonymous, ...init } = options;
  const session = anonymous ? null : getSession();

  return fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Uma renovação por vez.
 *
 * O painel dispara várias requisições juntas; se cada 401 renovasse por conta
 * própria, a segunda usaria um refresh que a primeira já tinha rotacionado —
 * e o backend responderia "token na blacklist", derrubando a sessão de quem
 * ainda estava dentro do prazo.
 */
let renewal: Promise<boolean> | null = null;

function renewSession(): Promise<boolean> {
  if (!renewal) {
    renewal = runRenewal();
    void renewal.finally(() => {
      renewal = null;
    });
  }
  return renewal;
}

async function runRenewal(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;

  try {
    const renewed = await request<{ access: string; refresh?: string }>("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: session.refresh }),
      anonymous: true,
    });
    setTokens(renewed.access, renewed.refresh ?? session.refresh);
    return true;
  } catch {
    // Refresh vencido, rotacionado ou invalidado no logout: acabou a sessão.
    // Quem observa o armazenamento (a nav e a guarda de rota) reage sozinho.
    clearSession();
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  // 401 com sessão guardada quase sempre é access vencido — 30 minutos. Renova
  // uma vez e repete a requisição; o corpo é string, dá para reenviar.
  if (response.status === 401 && !options.anonymous && getSession()) {
    if (await renewSession()) {
      response = await send(path, options);
    }
  }

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

export const authApi = {
  /** POST /api/auth/register/ — 201 já devolve o par de tokens */
  register(payload: RegisterPayload): Promise<AuthSession> {
    return request<AuthSession>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
      anonymous: true,
    });
  },

  /** POST /api/auth/login/ */
  login(payload: LoginPayload): Promise<AuthSession> {
    return request<AuthSession>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(payload),
      anonymous: true,
    });
  },

  /** POST /api/auth/logout/ — invalida o refresh no servidor */
  logout(refresh: string): Promise<void> {
    return request<void>("/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    });
  },

  /** GET /api/auth/me/ */
  me(): Promise<AuthUser> {
    return request<AuthUser>("/auth/me/");
  },
};

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
