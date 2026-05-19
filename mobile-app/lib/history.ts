import { getAuthToken, getBackendUrl } from './storage';

export interface HistoryItem {
  id: number;
  title: string;
  author?: string | null;
  year?: string | null;
  cover_image_url?: string | null;
  goodreads_rating?: number | null;
  google_rating?: number | null;
  genres?: string[] | null;
  looked_up_at: string;
}

async function historyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [token, backendUrl] = await Promise.all([getAuthToken(), getBackendUrl()]);
  if (!token) throw new Error('not_signed_in');
  return fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export async function getHistory(): Promise<HistoryItem[]> {
  const resp = await historyFetch('/api/history');
  if (!resp.ok) return [];
  return resp.json();
}

export async function addToHistory(item: Omit<HistoryItem, 'id' | 'looked_up_at'>): Promise<void> {
  await historyFetch('/api/history', { method: 'POST', body: JSON.stringify(item) });
}

export async function removeFromHistory(id: number): Promise<void> {
  await historyFetch(`/api/history/${id}`, { method: 'DELETE' });
}

export async function clearHistory(): Promise<void> {
  await historyFetch('/api/history', { method: 'DELETE' });
}
