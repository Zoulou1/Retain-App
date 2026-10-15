const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('retain_token');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token && !path.startsWith('/auth/sign')) {
    if (localStorage.getItem('retain_token') === token) {
      localStorage.removeItem('retain_token');
      window.dispatchEvent(new Event('retain-session-expired'));
    }
  }
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data as T;
}
