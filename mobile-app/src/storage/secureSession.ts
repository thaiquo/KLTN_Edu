import { platformStorage } from './platformStorage';

const REFRESH_KEY = 'educonnect.refresh.v1';

export const secureSession = {
  readRefresh: () => platformStorage.getItem(REFRESH_KEY),
  saveRefresh: (token: string) => platformStorage.setItem(REFRESH_KEY, token),
  clear: () => platformStorage.deleteItem(REFRESH_KEY),
};
