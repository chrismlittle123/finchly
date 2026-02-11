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
