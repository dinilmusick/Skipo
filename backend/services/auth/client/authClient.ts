/**
 * @file authClient.ts
 * @description Client-side Auth Helper for browser cookie/token management.
 * Conforms to < 200 lines limit.
 */

export class AuthClient {
  private static TOKEN_KEY = 'skipo_auth_token';

  public getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AuthClient.TOKEN_KEY) || this.getCookie('token');
  }

  public setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AuthClient.TOKEN_KEY, token);
  }

  public clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AuthClient.TOKEN_KEY);
    document.cookie = 'token=; Max-Age=0; path=/;';
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
}

export const authClient = new AuthClient();
