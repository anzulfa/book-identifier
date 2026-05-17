import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'bi_device_id';
const BACKEND_URL_KEY = 'bi_backend_url';
const DEFAULT_BACKEND_URL = 'https://book-identifier-production.up.railway.app';

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getBackendUrl(): Promise<string> {
  const stored = await SecureStore.getItemAsync(BACKEND_URL_KEY);
  return (stored || DEFAULT_BACKEND_URL).replace(/\/$/, '');
}

export async function setBackendUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(BACKEND_URL_KEY, url.trim().replace(/\/$/, ''));
}
