import type { EnrichmentResult, EnricherContext } from "./types.js";
import { parseGitHubUrl } from "../../lib/source-type.js";

interface GitHubRepoResponse {
  full_name: string;
  description: string | null;
  owner: { avatar_url: string };
  default_branch: string;
}

export async function enrichGitHub(
  url: string,
  ctx: EnricherContext,
): Promise<EnrichmentResult> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return { sourceType: "github" };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "finchly-bot",
  };
  if (ctx.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`;
  }

  const repoRes = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers },
  );

  if (!repoRes.ok) {
    ctx.logger.warn({ status: repoRes.status, url }, "GitHub API request failed");
    return { sourceType: "github" };
  }

  const repo = (await repoRes.json()) as GitHubRepoResponse;
  const ref = parsed.ref ?? repo.default_branch;

  let rawContent: string | undefined;
  let title = repo.full_name;

  const base = { owner: parsed.owner, repo: parsed.repo, ref };

  if (parsed.pathType === "blob" && parsed.filePath) {
    title = `${repo.full_name}/${parsed.filePath}`;
    rawContent = await fetchRawFile(base, parsed.filePath, ctx);
  } else if (parsed.pathType === "tree" && parsed.filePath) {
    title = `${repo.full_name}/${parsed.filePath}`;
    rawContent = await fetchRawFile(base, `${parsed.filePath}/README.md`, ctx);
  } else {
    rawContent = await fetchRawFile(base, "README.md", ctx);
  }

  return {
    title,
    description: repo.description ?? undefined,
    imageUrl: repo.owner.avatar_url,
    rawContent,
    sourceType: "github",
  };
}

async function fetchRawFile(
  repo: { owner: string; repo: string; ref: string },
  path: string,
  ctx: EnricherContext,
): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.ref}/${path}`,
      { headers: { "User-Agent": "finchly-bot" } },
    );
    if (res.ok) return res.text();
    ctx.logger.debug({ status: res.status, path: `${repo.owner}/${repo.repo}/${repo.ref}/${path}` }, "Raw file fetch returned non-200");
  } catch {
    // Best-effort
  }
  return undefined;
}
