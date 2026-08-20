/**
 * Espelho dos serializadores do backend. Cada campo aqui existe de fato em
 * `shortener/serializers.py` — a interface não inventa métrica.
 */

/** ClickSerializer */
export interface ClickRecord {
  id: number;
  ip_address: string;
  user_agent: string;
  referer: string | null;
  clicked_at: string;
}

/** `status` — derivado de ShortenedURL.can_be_accessed() */
export interface LinkStatus {
  can_access: boolean;
  message: string;
}

/** `statistics` do ShortenedURLDetailSerializer */
export interface LinkStatistics {
  total_clicks: number;
  unique_clicks: number;
  is_expired: boolean;
  has_reached_max_clicks: boolean;
}

/** ShortenedURLListSerializer — note que NÃO traz expires_at/max_clicks/qr_code */
export interface LinkListItem {
  id: number;
  short_code: string;
  original_url: string;
  short_url: string;
  is_active: boolean;
  total_clicks: number;
  unique_clicks: number;
  status: LinkStatus;
  created_at: string;
}

/** ShortenedURLDetailSerializer */
export interface LinkDetail extends LinkListItem {
  expires_at: string | null;
  max_clicks: number;
  qr_code: string | null;
  statistics: LinkStatistics;
  recent_clicks: ClickRecord[];
  updated_at: string;
}

/** GET /api/urls/{code}/statistics/ — 20 cliques, sem qr_code e sem short_url */
export interface LinkStatisticsResponse {
  short_code: string;
  original_url: string;
  is_active: boolean;
  total_clicks: number;
  unique_clicks: number;
  is_expired: boolean;
  has_reached_max_clicks: boolean;
  expires_at: string | null;
  max_clicks: number;
  created_at: string;
  recent_clicks: ClickRecord[];
}

/** GET /api/urls/{code}/qrcode/ */
export interface QrCodeResponse {
  short_code: string;
  qr_code_url: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Campos aceitos por ShortenedURLCreateSerializer */
export interface CreateLinkPayload {
  original_url: string;
  short_code?: string;
  expires_at?: string | null;
  max_clicks?: number | null;
}

/** Campos aceitos por ShortenedURLUpdateSerializer */
export interface UpdateLinkPayload {
  original_url?: string;
  is_active?: boolean;
  expires_at?: string | null;
  max_clicks?: number | null;
}

/** Os quatro estados visíveis, na ordem de precedência de can_be_accessed() */
export type LinkState = "active" | "inactive" | "expired" | "max_clicks";
