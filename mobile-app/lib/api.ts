import { getOrCreateDeviceId, getBackendUrl } from './storage';

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

export async function lookupBook(imageBase64: string): Promise<BookResult> {
  const [deviceId, backendUrl] = await Promise.all([
    getOrCreateDeviceId(),
    getBackendUrl(),
  ]);

  const resp = await fetch(`${backendUrl}/api/lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
    },
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
