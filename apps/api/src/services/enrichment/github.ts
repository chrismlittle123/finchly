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

  // Fetch README for rawContent
  let rawContent: string | undefined;
  try {
    const readmeRes = await fetch(
      `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${repo.default_branch}/README.md`,
      { headers: { "User-Agent": "finchly-bot" } },
    );
    if (readmeRes.ok) {
      rawContent = await readmeRes.text();
    }
  } catch {
    // README fetch is best-effort
  }

  return {
    title: repo.full_name,
    description: repo.description ?? undefined,
    imageUrl: repo.owner.avatar_url,
    rawContent,
    sourceType: "github",
  };
}
