// All API calls route through the Vite proxy (/api → http://localhost:3001)
// The token travels in X-Linode-Token header — never stored on disk.

export async function apiFetch<T = unknown>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Linode-Token": token,
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.reason ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
