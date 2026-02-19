import Cookies from 'js-cookie';

const isProduction =
  typeof window !== 'undefined' &&
  window.location.hostname.includes('aveyo.com');

export const supabaseCookieStorage = {
  getItem: (key: string): string | null =>
    Cookies.get(key) ?? null,

  setItem: (key: string, value: string): void => {
    Cookies.set(key, value, {
      domain: isProduction ? '.aveyo.com' : undefined,
      secure: isProduction,
      sameSite: 'lax',
      expires: 365,
    });
  },

  removeItem: (key: string): void => {
    Cookies.remove(key, {
      domain: isProduction ? '.aveyo.com' : undefined,
    });
  },
};
