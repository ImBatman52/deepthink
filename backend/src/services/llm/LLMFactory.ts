import { BaseLLMProvider } from './BaseLLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { llmConfig } from '../../config/llm.config.js';

/**
 * LLMFactory with instance caching.
 * Reuses OpenAI client instances when config (apiKey + baseUrl + model) hasn't changed,
 * avoiding redundant TCP/TLS handshake overhead per request.
 */
/** Maximum number of cached provider instances to prevent memory leaks. */
const MAX_CACHE_SIZE = 20;

export class LLMFactory {
  private static cache = new Map<string, BaseLLMProvider>();

  private static getCacheKey(config: any): string {
    return `${config.provider || 'openai'}:${config.apiKey || ''}:${config.baseUrl || ''}:${config.defaultModel || ''}`;
  }

  static createLLM(customConfig?: any): BaseLLMProvider {
    const config = customConfig || llmConfig.get();

    // Validate essential config before creating a provider
    if (!config.apiKey) {
      throw new Error(
        'LLM API Key 未配置。请在管理面板 (/admin) 中设置 API Key，或在 .env 中配置 OPENAI_API_KEY。'
      );
    }

    const cacheKey = this.getCacheKey(config);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Evict oldest entries if cache is too large
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    let provider: BaseLLMProvider;
    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config.apiKey, config.baseUrl, config.defaultModel);
        break;
      default:
        // All providers use OpenAI-compatible API format
        provider = new OpenAIProvider(config.apiKey, config.baseUrl, config.defaultModel);
        break;
    }

    this.cache.set(cacheKey, provider);
    return provider;
  }

  /**
   * Clear the provider cache (e.g., after config changes via admin panel).
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
