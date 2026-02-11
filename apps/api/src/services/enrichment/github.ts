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

  if (parsed.pathType === "blob" && parsed.filePath) {
    // Specific file — fetch it directly
    title = `${repo.full_name}/${parsed.filePath}`;
    rawContent = await fetchRawFile(parsed.owner, parsed.repo, ref, parsed.filePath, ctx);
  } else if (parsed.pathType === "tree" && parsed.filePath) {
    // Subdirectory — try README.md inside it
    title = `${repo.full_name}/${parsed.filePath}`;
    rawContent = await fetchRawFile(parsed.owner, parsed.repo, ref, `${parsed.filePath}/README.md`, ctx);
  } else {
    // Root — fetch top-level README
    rawContent = await fetchRawFile(parsed.owner, parsed.repo, ref, "README.md", ctx);
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
  owner: string,
  repo: string,
  ref: string,
  path: string,
  ctx: EnricherContext,
): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
      { headers: { "User-Agent": "finchly-bot" } },
    );
    if (res.ok) return res.text();
    ctx.logger.debug({ status: res.status, path: `${owner}/${repo}/${ref}/${path}` }, "Raw file fetch returned non-200");
  } catch {
    // Best-effort
  }
  return undefined;
}
