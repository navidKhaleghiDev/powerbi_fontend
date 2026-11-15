import { API_CONFIG } from './config';

const API_BASE_URL = API_CONFIG.baseURL;

export const apiUrl = (endpoint: string): string => {
  const path = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint.replace(/^\/+/, '')}`;
  return `${API_BASE_URL}${path}`;
};

export const rawApiRequest = async (
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(API_CONFIG.headers);
  new Headers(init.headers).forEach((value, name) => {
    headers.set(name, value);
  });
  const locale = document.documentElement.lang === 'en' ? 'en' : 'fa';
  headers.set('Accept-Language', locale);
  headers.set('Content-Language', locale);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    return await fetch(apiUrl(endpoint), { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
};

const messageFromErrorBody = (body: unknown): string | null => {
  if (typeof body === 'string') return body.trim() || null;
  if (Array.isArray(body)) {
    const messages = body
      .map(messageFromErrorBody)
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(' · ') : null;
  }
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  for (const key of ['detail', 'message', 'error', 'errors', 'msg', 'non_field_errors']) {
    if (key in record) {
      const message = messageFromErrorBody(record[key]);
      if (message) return message;
    }
  }
  const fields = Object.entries(record).flatMap(([field, value]) => {
    const message = messageFromErrorBody(value);
    return message ? [`${field}: ${message}`] : [];
  });
  return fields.length ? fields.join(' · ') : null;
};

export const readError = async (response: Response): Promise<string> => {
  try {
    const message = messageFromErrorBody(await response.clone().json());
    if (message) return message;
  } catch {
    // Continue with plain text responses when the server does not return JSON.
  }
  const text = (
    await response
      .clone()
      .text()
      .catch(() => '')
  ).trim();
  if (text && !/^<!doctype html|^<html\b/i.test(text)) return text.slice(0, 500);
  return `Request failed (${response.status})`;
};
