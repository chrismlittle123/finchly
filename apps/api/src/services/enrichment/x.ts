import type { EnrichmentResult, EnricherContext } from "./types.js";

// --- Syndication API types ---

interface SyndicationUser {
  name: string;
  screen_name: string;
  profile_image_url_https: string;
}

interface SyndicationUrl {
  url: string;
  expanded_url: string;
  display_url: string;
}

interface SyndicationArticle {
  title: string;
  preview_text: string;
  cover_media?: {
    media_info: {
      original_img_url: string;
      original_img_width: number;
      original_img_height: number;
    };
  };
}

export interface SyndicationTweet {
  text: string;
  lang: string;
  created_at: string;
  favorite_count: number;
  conversation_count: number;
  note_tweet?: { id: string };
  user: SyndicationUser;
  entities: {
    urls: SyndicationUrl[];
    user_mentions: Array<{ screen_name: string }>;
  };
  photos?: Array<{ url: string }>;
  video?: { poster: string };
  mediaDetails?: Array<{ type: string; media_url_https: string }>;
  article?: SyndicationArticle;
}

// --- FXTwitter API types (full tweet text) ---

interface FxTweet {
  text: string;
  author: { name: string; screen_name: string };
}

interface FxResponse {
  code: number;
  tweet?: FxTweet;
}

/**
 * Extract tweet ID from various X/Twitter URL formats.
 * Supports: x.com/user/status/ID, twitter.com/user/status/ID, x.com/i/status/ID
 */
export function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match?.[1] ?? null;
}

/**
 * Fetch structured tweet data from Twitter's syndication CDN.
 * This is the backend for Twitter's embed widgets — no auth required.
 * Returns pre-resolved URLs, media URLs, article metadata, and engagement counts.
 * Text may be truncated at ~280 chars for long tweets.
 */
export async function fetchSyndication(tweetId: string): Promise<SyndicationTweet | null> {
  const res = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`,
  );
  if (!res.ok) return null;
  return (await res.json()) as SyndicationTweet;
}

/**
 * Fetch full tweet text from FXTwitter API (open-source, no auth).
 * Used to get untruncated text when syndication truncates long tweets.
 */
async function fetchFullText(tweetId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.fxtwitter.com/status/${tweetId}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as FxResponse;
    return data.tweet?.text ?? null;
  } catch {
    return null;
  }
}

export function buildEnrichmentResult(
  tweet: SyndicationTweet,
  fullText?: string,
): EnrichmentResult {
  const { user, entities, article } = tweet;

  // Use full text if available (from fxtwitter), otherwise syndication text
  const tweetText = fullText ?? tweet.text;

  // Collect resolved external URLs (syndication pre-resolves t.co → expanded_url)
  const externalUrls = (entities.urls ?? [])
    .map((u) => u.expanded_url)
    .filter((u) => !u.includes("x.com/i/article/") && !u.includes("twitter.com/i/article/"));

  // Pick the best image: article cover > first photo > video poster
  const imageUrl =
    article?.cover_media?.media_info.original_img_url ??
    tweet.photos?.[0]?.url ??
    tweet.video?.poster ??
    undefined;

  // Build description: article preview or tweet text
  const description = article
    ? `${article.title}\n\n${article.preview_text}`
    : tweetText;

  // Build title: article title or author attribution
  const title = article?.title ?? `${user.name} (@${user.screen_name})`;

  // Build rawContent with all available context
  const parts = [
    `@${user.screen_name}: ${tweetText}`,
    article ? `\nArticle: ${article.title}\n${article.preview_text}` : "",
    externalUrls.length > 0 ? `\nLinks: ${externalUrls.join(", ")}` : "",
  ];

  return {
    title,
    description,
    imageUrl,
    rawContent: parts.join(""),
    sourceType: "x",
    extractedUrls: externalUrls,
  };
}

export async function enrichX(
  url: string,
  ctx: EnricherContext,
): Promise<EnrichmentResult> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    ctx.logger.warn({ url }, "Could not extract tweet ID from URL");
    return { sourceType: "x" };
  }

  // Fetch syndication (structured data) and fxtwitter (full text) in parallel
  const [tweet, fxText] = await Promise.all([
    fetchSyndication(tweetId),
    fetchFullText(tweetId),
  ]);

  if (!tweet) {
    ctx.logger.warn({ url, tweetId }, "Syndication API returned no data");
    return { sourceType: "x" };
  }

  // Take the longer text
  const fullText = fxText && fxText.length > tweet.text.length ? fxText : undefined;
  if (fullText) {
    ctx.logger.info({ url, tweetId, synLen: tweet.text.length, fullLen: fullText.length },
      "Using fxtwitter full text (longer)");
  }

  ctx.logger.info({ url, tweetId }, "Enriched via syndication API");
  return buildEnrichmentResult(tweet, fullText);
}
