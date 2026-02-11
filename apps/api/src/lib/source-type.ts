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

export interface GitHubParsed {
  owner: string;
  repo: string;
  /** "blob" = specific file, "tree" = subdirectory, "root" = repo root */
  pathType: "blob" | "tree" | "root";
  /** ref (branch/tag/commit) — only set for blob/tree URLs */
  ref?: string;
  /** path within the repo — only set for blob/tree URLs */
  filePath?: string;
}

/** @deprecated Use GitHubParsed instead */
export type GitHubRepo = GitHubParsed;

export function parseGitHubUrl(url: string): GitHubParsed | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;

    // pathname like /owner/repo or /owner/repo/blob/main/src/index.ts
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1];

    // /owner/repo/blob/ref/path/to/file
    // /owner/repo/tree/ref/path/to/dir
    if (segments.length >= 4 && (segments[2] === "blob" || segments[2] === "tree")) {
      const pathType = segments[2] as "blob" | "tree";
      const ref = segments[3];
      const filePath = segments.slice(4).join("/") || undefined;
      return { owner, repo, pathType, ref, filePath };
    }

    return { owner, repo, pathType: "root" };
  } catch {
    return null;
  }
}
