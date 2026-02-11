import { generateTestToken } from "./auth.js";

export const API_URL =
  process.env.API_URL ??
  "https://finchly-api-dev-10492061315.europe-west2.run.app";

const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-that-is-at-least-32-characters-long";
const token = process.env.API_TOKEN ?? generateTestToken(JWT_SECRET);

export async function api(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers });
}

/** Check that the API is reachable AND our JWT is accepted. */
export async function checkApiReady(): Promise<boolean> {
  const health = await fetch(`${API_URL}/health`).catch(() => null);
  if (!health?.ok) {
    console.log(`  API not reachable at ${API_URL} — skipping tests`);
    return false;
  }

  const auth = await api("/v1/links?limit=1");
  if (auth.status === 401) {
    console.log(`  Auth failed (401) — set JWT_SECRET or API_TOKEN env var to match the deployed API`);
    return false;
  }

  return true;
}
