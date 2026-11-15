export interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  error?: string;
}

export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  access?: string;
  refresh?: string;
  has_qrcode?: boolean;
  message?: string;
  temp_token?: string;
  expires_at?: number;
  expires_in?: number;
  qr_code?: string;
  info?: string;
}

export interface ResponsePagination<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}
