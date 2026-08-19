export interface ShortcutStatus {
  can_access: boolean;
  message: string;
}

export interface ShortcutStatistics {
  total_clicks: number;
  unique_clicks: number;
  is_expired: boolean;
  has_reached_max_clicks: boolean;
}

export interface Shortcut {
  id: number;
  original_url: string;
  short_code: string;
  short_url: string;
  is_active: boolean;
  expires_at: string | null;
  max_clicks: number;
  total_clicks: number;
  unique_clicks: number;
  qr_code?: string | null;
  statistics?: ShortcutStatistics;
  status: ShortcutStatus;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedShortcuts {
  count: number;
  next: string | null;
  previous: string | null;
  results: Shortcut[];
}

export interface CreateShortcutPayload {
  original_url: string;
  short_code: string;
}
