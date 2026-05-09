/**
 * Universal LLM Provider — Supports ANY OpenAI-compatible API
 * ============================================================
 * Works with: OpenAI, Featherless.ai, TokenRouter, Together.ai, Groq,
 * Anthropic (via proxy), Ollama, LM Studio, vLLM, HuggingFace, etc.
 * 
 * Users configure: baseURL, apiKey, model name
 * System handles: streaming, error recovery, fallback chain
 */

export interface LLMProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  latencyMs?: number;
}

// ═══ PRESET PROVIDERS ═══
export const PRESET_PROVIDERS: Record<string, Partial<LLMProviderConfig>> = {
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  featherless: { name: 'Featherless.ai', baseUrl: 'https://api.featherless.ai/v1', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct' },
  tokenrouter: { name: 'TokenRouter', baseUrl: 'https://api.tokenrouter.ai/v1', model: 'auto' },
  together: { name: 'Together.ai', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  ollama: { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  lmstudio: { name: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.1-70b-instruct' },
  huggingface: { name: 'HuggingFace', baseUrl: 'https://api-inference.huggingface.co/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
  mistral: { name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
  anthropic_proxy: { name: 'Anthropic (OpenAI-compat)', baseUrl: 'https://anthropic.api-proxy.com/v1', model: 'claude-3-5-sonnet-20241022' },
  custom: { name: 'Custom Provider', baseUrl: '', model: '' },
};

// ═══ UNIVERSAL LLM CLIENT ═══

export class UniversalLLM {
  private providers: LLMProviderConfig[] = [];
  
  constructor(providers?: LLMProviderConfig[]) {
    if (providers) this.providers = providers;
  }

  addProvider(config: LLMProviderConfig) {
    this.providers.push(config);
  }

  /**
   * Get the best available provider (first enabled one with valid config)
   */
  private getActiveProvider(): LLMProviderConfig | null {
    return this.providers.find(p => p.enabled && p.baseUrl && p.apiKey && p.model) || null;
  }

  /**
   * Send a chat completion request to any OpenAI-compatible API
   */
  async chat(messages: LLMMessage[], options?: { maxTokens?: number; temperature?: number; responseFormat?: any }): Promise<LLMResponse> {
    const provider = this.getActiveProvider();
    
    if (!provider) {
      return { content: this.getFallbackResponse(messages), model: 'fallback', provider: 'local' };
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
          'HTTP-Referer': 'https://forensix-ai.app',
          'X-Title': 'ForensiX AI',
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: options?.maxTokens || provider.maxTokens || 2000,
          temperature: options?.temperature ?? provider.temperature ?? 0.3,
          ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`LLM Error [${provider.name}]:`, response.status, errorData);
        // Try next provider
        return this.chatWithFallback(messages, options, provider);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens;

      return {
        content,
        model: provider.model,
        provider: provider.name,
        tokensUsed,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error(`LLM Connection Error [${provider.name}]:`, error.message);
      return this.chatWithFallback(messages, options, provider);
    }
  }

  /**
   * Streaming chat completion
   */
  async *streamChat(messages: LLMMessage[], options?: { maxTokens?: number; temperature?: number }): AsyncGenerator<string> {
    const provider = this.getActiveProvider();
    if (!provider) {
      yield this.getFallbackResponse(messages);
      return;
    }

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature ?? 0.3,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        yield this.getFallbackResponse(messages);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {}
          }
        }
      }
    } catch (error) {
      yield this.getFallbackResponse(messages);
    }
  }

  /**
   * Try fallback provider when primary fails
   */
  private async chatWithFallback(messages: LLMMessage[], options: any, failedProvider: LLMProviderConfig): Promise<LLMResponse> {
    const remaining = this.providers.filter(p => p !== failedProvider && p.enabled && p.baseUrl && p.apiKey);
    if (remaining.length > 0) {
      const backup = new UniversalLLM(remaining);
      return backup.chat(messages, options);
    }
    return { content: this.getFallbackResponse(messages), model: 'fallback', provider: 'local' };
  }

  /**
   * Intelligent fallback when no LLM is available
   */
  private getFallbackResponse(messages: LLMMessage[]): string {
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    if (lastMsg.includes('time of death') || lastMsg.includes('pmi'))
      return '## ⏱️ Time of Death\n\nUse the Henssge Nomogram (1988) — the gold standard for early PMI. Formula: T = T_amb + (37.2-T_amb) × [1.25e^(-Bt) - 0.25e^(-5Bt)]. Configure an LLM provider in Settings for detailed AI analysis.';
    if (lastMsg.includes('injur') || lastMsg.includes('wound'))
      return '## 🩹 Injury Analysis\n\nKey patterns: Defensive wounds (forearms), blunt force (contusions/fractures), sharp force (stab/incised), asphyxia (petechiae/ligature marks). Configure an LLM in Settings for AI-powered interpretation.';
    return '## 🔬 ForensiX AI\n\nNo LLM provider configured. Go to **Settings → LLM Configuration** to add your API credentials for:\n- Featherless.ai\n- TokenRouter\n- OpenAI\n- Together.ai\n- Groq\n- Or any OpenAI-compatible API\n\nThe system will work with ANY provider that supports the OpenAI chat completions format.';
  }
}

// ═══ SINGLETON INSTANCE (built from env vars) ═══

export function createLLMFromEnv(): UniversalLLM {
  const llm = new UniversalLLM();

  // Auto-detect configured providers from environment
  if (process.env.OPENAI_API_KEY) {
    llm.addProvider({
      name: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: 2000, temperature: 0.3, enabled: true,
    });
  }
  if (process.env.FEATHERLESS_API_KEY) {
    llm.addProvider({
      name: 'Featherless.ai', baseUrl: 'https://api.featherless.ai/v1',
      apiKey: process.env.FEATHERLESS_API_KEY, model: process.env.FEATHERLESS_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      maxTokens: 2000, temperature: 0.3, enabled: true,
    });
  }
  if (process.env.TOKENROUTER_API_KEY) {
    llm.addProvider({
      name: 'TokenRouter', baseUrl: process.env.TOKENROUTER_BASE_URL || 'https://api.tokenrouter.ai/v1',
      apiKey: process.env.TOKENROUTER_API_KEY, model: process.env.TOKENROUTER_MODEL || 'auto',
      maxTokens: 2000, temperature: 0.3, enabled: true,
    });
  }
  if (process.env.TOGETHER_API_KEY) {
    llm.addProvider({
      name: 'Together.ai', baseUrl: 'https://api.together.xyz/v1',
      apiKey: process.env.TOGETHER_API_KEY, model: process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      maxTokens: 2000, temperature: 0.3, enabled: true,
    });
  }
  if (process.env.GROQ_API_KEY) {
    llm.addProvider({
      name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      maxTokens: 2000, temperature: 0.3, enabled: true,
    });
  }
  // Custom provider (user sets all via env)
  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL) {
    llm.addProvider({
      name: process.env.LLM_PROVIDER_NAME || 'Custom',
      baseUrl: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL,
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
      enabled: true,
    });
  }

  return llm;
}

// Export singleton
export const llm = createLLMFromEnv();
