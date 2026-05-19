import { getOrCreateDeviceId, getBackendUrl, getAuthToken } from './storage';

export interface BookResult {
  title: string;
  author: string;
  year?: string;
  cover_image_url?: string | null;
  goodreads_rating?: number | null;
  goodreads_ratings_count?: number | null;
  google_rating?: number | null;
  google_ratings_count?: number | null;
  genres?: string[];
  plot_summary?: string;
  reviews_summary?: string;
  source_urls?: { goodreads?: string };
}

export class RateLimitError extends Error {
  isRateLimit = true;
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export interface AuthResponse {
  access_token: string;
  email: string;
  name?: string | null;
  is_premium: boolean;
}

async function authRequest(path: string, body: object): Promise<AuthResponse> {
  const backendUrl = await getBackendUrl();
  const resp = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail ?? `Server error ${resp.status}`);
  return data;
}

export function authLogin(email: string, password: string): Promise<AuthResponse> {
  return authRequest('/api/auth/login', { email, password });
}

export function authRegister(email: string, password: string, name?: string): Promise<AuthResponse> {
  return authRequest('/api/auth/register', { email, password, name });
}

export function authGoogle(accessToken: string): Promise<AuthResponse> {
  return authRequest('/api/auth/google', { access_token: accessToken });
}

export async function lookupBook(imageBase64: string): Promise<BookResult> {
  const [deviceId, backendUrl, token] = await Promise.all([
    getOrCreateDeviceId(),
    getBackendUrl(),
    getAuthToken(),
  ]);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['X-Device-ID'] = deviceId;
  }

  const resp = await fetch(`${backendUrl}/api/lookup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (resp.status === 429) {
    const body = await resp.json().catch(() => ({}));
    throw new RateLimitError(
      body.detail ?? "You've reached the free tier daily limit. Try again tomorrow."
    );
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? `Server error ${resp.status}`);
  }

  return resp.json();
}
