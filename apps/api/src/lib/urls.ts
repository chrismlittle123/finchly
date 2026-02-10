const URL_REGEX = /https?:\/\/[^\s>]+/g;

export function extractUrls(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(URL_REGEX)].map((m) => m[0]);
}
