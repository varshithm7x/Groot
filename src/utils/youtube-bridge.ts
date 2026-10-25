import { getAPI } from "./api";

export interface YouTubeBridge {
  status(): Promise<{ configured: boolean; secureStorage: boolean; sessionOnly?: boolean }>;
  saveKey(key: string): Promise<{ configured: boolean; secureStorage: boolean; sessionOnly?: boolean }>;
  useSessionKey(key: string): Promise<{ configured: boolean; secureStorage: boolean; sessionOnly?: boolean }>;
  disconnect(): Promise<{ configured: boolean; secureStorage: boolean; sessionOnly?: boolean }>;
  search(query: string, requestId: string, consent: true): Promise<unknown>;
  cancel(requestId: string): Promise<void>;
}

export function getYouTubeBridge(): YouTubeBridge | undefined {
  return getAPI().youtube;
}
