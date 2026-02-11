/**
 * Thin LLM gateway client matching the @palindrom-ai/llm-client API.
 * Replace this file with `import { LLMClient } from "@palindrom-ai/llm-client"`
 * once the package is published to npm.
 */

export interface CompletionRequest {
  model: string;
  messages: Array<{ [key: string]: string }>;
  fallbacks?: Array<string> | null;
  max_retries?: number | null;
  timeout?: number | null;
}

export interface CompletionResponse {
  content: string;
  usage: { [key: string]: unknown };
}

export interface LLMClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
}

export class LLMClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: LLMClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.headers = options.headers ?? {};
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Complete request failed: ${body}`);
    }

    return (await response.json()) as CompletionResponse;
  }
}
