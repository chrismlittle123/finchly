export type SourceType = "github" | "x" | "webpage";

export function detectSourceType(url: string): SourceType {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "github.com" || host === "www.github.com") {
      return "github";
    }

    if (
      host === "x.com" ||
      host === "www.x.com" ||
      host === "twitter.com" ||
      host === "www.twitter.com" ||
      host === "mobile.twitter.com"
    ) {
      return "x";
    }

    return "webpage";
  } catch {
    return "webpage";
  }
}

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export function parseGitHubUrl(url: string): GitHubRepo | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;

    // pathname like /owner/repo or /owner/repo/tree/main/...
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    return { owner: segments[0], repo: segments[1] };
  } catch {
    return null;
  }
}
