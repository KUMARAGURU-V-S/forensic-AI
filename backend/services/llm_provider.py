"""
Universal LLM Provider — Supports ANY OpenAI-compatible API.
Ported from forensix-ai-nextjs lib/llm-provider.ts

Works with: OpenAI, Featherless.ai, TokenRouter, Together.ai, Groq,
HuggingFace, Ollama, LM Studio, vLLM, DeepSeek, Mistral, OpenRouter, etc.
"""
import os
import time
import json
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator

# ═══ PROVIDER CONFIG ═══

PRESET_PROVIDERS = {
    "openai": {"name": "OpenAI", "base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    "featherless": {"name": "Featherless.ai", "base_url": "https://api.featherless.ai/v1", "model": "meta-llama/Meta-Llama-3.1-70B-Instruct"},
    "tokenrouter": {"name": "TokenRouter", "base_url": "https://api.tokenrouter.ai/v1", "model": "auto"},
    "together": {"name": "Together.ai", "base_url": "https://api.together.xyz/v1", "model": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"},
    "groq": {"name": "Groq", "base_url": "https://api.groq.com/openai/v1", "model": "llama-3.3-70b-versatile"},
    "deepseek": {"name": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    "ollama": {"name": "Ollama (Local)", "base_url": "http://localhost:11434/v1", "model": "llama3.1"},
    "lmstudio": {"name": "LM Studio (Local)", "base_url": "http://localhost:1234/v1", "model": "local-model"},
    "openrouter": {"name": "OpenRouter", "base_url": "https://openrouter.ai/api/v1", "model": "meta-llama/llama-3.1-70b-instruct"},
    "huggingface": {"name": "HuggingFace", "base_url": "https://api-inference.huggingface.co/v1", "model": "Qwen/Qwen2.5-72B-Instruct"},
    "mistral": {"name": "Mistral AI", "base_url": "https://api.mistral.ai/v1", "model": "mistral-large-latest"},
}


class LLMProvider:
    def __init__(self, name: str, base_url: str, api_key: str, model: str,
                 max_tokens: int = 2000, temperature: float = 0.3, enabled: bool = True):
        self.name = name
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.enabled = enabled


class UniversalLLM:
    """Universal LLM client supporting any OpenAI-compatible API."""

    def __init__(self):
        self.providers: List[LLMProvider] = []

    def add_provider(self, provider: LLMProvider):
        self.providers.append(provider)

    def get_active_provider(self) -> Optional[LLMProvider]:
        for p in self.providers:
            if p.enabled and p.base_url and p.api_key and p.model:
                return p
        return None

    def chat(self, messages: List[Dict[str, str]], max_tokens: int = None,
             temperature: float = None) -> Dict[str, Any]:
        """Send a chat completion request to any OpenAI-compatible API."""
        provider = self.get_active_provider()
        if not provider:
            return {
                "content": self._fallback_response(messages),
                "model": "fallback",
                "provider": "local",
                "tokens_used": 0,
                "latency_ms": 0,
            }

        start = time.time()
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    f"{provider.base_url}/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {provider.api_key}",
                        "HTTP-Referer": "https://forensix-ai.app",
                        "X-Title": "ForensiX AI",
                    },
                    json={
                        "model": provider.model,
                        "messages": messages,
                        "max_tokens": max_tokens or provider.max_tokens,
                        "temperature": temperature if temperature is not None else provider.temperature,
                    },
                )
                if resp.status_code != 200:
                    print(f"[LLM] {provider.name} error {resp.status_code}: {resp.text[:200]}")
                    return self._try_fallback(messages, max_tokens, temperature, provider)

                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                tokens = data.get("usage", {}).get("total_tokens", 0)

                return {
                    "content": content,
                    "model": provider.model,
                    "provider": provider.name,
                    "tokens_used": tokens,
                    "latency_ms": int((time.time() - start) * 1000),
                }
        except Exception as e:
            print(f"[LLM] {provider.name} connection error: {e}")
            return self._try_fallback(messages, max_tokens, temperature, provider)

    def _try_fallback(self, messages, max_tokens, temperature, failed_provider):
        remaining = [p for p in self.providers if p != failed_provider and p.enabled and p.base_url and p.api_key]
        if remaining:
            backup = UniversalLLM()
            for p in remaining:
                backup.add_provider(p)
            return backup.chat(messages, max_tokens, temperature)
        return {
            "content": self._fallback_response(messages),
            "model": "fallback",
            "provider": "local",
            "tokens_used": 0,
            "latency_ms": 0,
        }

    def _fallback_response(self, messages: List[Dict[str, str]]) -> str:
        last = (messages[-1].get("content", "") if messages else "").lower()
        if "time of death" in last or "pmi" in last:
            return "Use the Henssge Nomogram (1988) — the gold standard for early PMI estimation. Configure an LLM provider in Settings for detailed AI analysis."
        if "injur" in last or "wound" in last:
            return "Key injury patterns: Defensive wounds (forearms), blunt force (contusions/fractures), sharp force (stab/incised), asphyxia (petechiae/ligature marks). Configure an LLM in Settings for AI interpretation."
        return "No LLM provider configured. Go to Settings → LLM Configuration to add API credentials for Featherless.ai, OpenAI, Together.ai, Groq, or any OpenAI-compatible API."


def create_llm_from_env() -> UniversalLLM:
    """Build singleton LLM instance from environment variables."""
    llm = UniversalLLM()

    _llm_key = (
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("FEATHERLESS_API_KEY") or ""
    )
    _llm_base = os.environ.get("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
    if _llm_key:
        llm.add_provider(LLMProvider(
            name="BotLearn/Featherless",
            base_url=_llm_base,
            api_key=_llm_key,
            model=os.environ.get("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct"),
        ))

    if os.environ.get("OPENAI_API_KEY"):
        llm.add_provider(LLMProvider(
            name="OpenAI",
            base_url="https://api.openai.com/v1",
            api_key=os.environ["OPENAI_API_KEY"],
            model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        ))

    if os.environ.get("TOKENROUTER_API_KEY"):
        llm.add_provider(LLMProvider(
            name="TokenRouter",
            base_url=os.environ.get("TOKENROUTER_BASE_URL", "https://api.tokenrouter.ai/v1"),
            api_key=os.environ["TOKENROUTER_API_KEY"],
            model=os.environ.get("TOKENROUTER_MODEL", "auto"),
        ))

    if os.environ.get("TOGETHER_API_KEY"):
        llm.add_provider(LLMProvider(
            name="Together.ai",
            base_url="https://api.together.xyz/v1",
            api_key=os.environ["TOGETHER_API_KEY"],
            model=os.environ.get("TOGETHER_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"),
        ))

    if os.environ.get("GROQ_API_KEY"):
        llm.add_provider(LLMProvider(
            name="Groq",
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ["GROQ_API_KEY"],
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        ))

    if os.environ.get("HF_TOKEN"):
        llm.add_provider(LLMProvider(
            name="HuggingFace",
            base_url="https://api-inference.huggingface.co/v1",
            api_key=os.environ["HF_TOKEN"],
            model=os.environ.get("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
        ))

    # Custom provider (user sets all via env)
    if os.environ.get("LLM_BASE_URL") and os.environ.get("LLM_API_KEY") and os.environ.get("LLM_MODEL"):
        llm.add_provider(LLMProvider(
            name=os.environ.get("LLM_PROVIDER_NAME", "Custom"),
            base_url=os.environ["LLM_BASE_URL"],
            api_key=os.environ["LLM_API_KEY"],
            model=os.environ["LLM_MODEL"],
            max_tokens=int(os.environ.get("LLM_MAX_TOKENS", "2000")),
            temperature=float(os.environ.get("LLM_TEMPERATURE", "0.3")),
        ))

    return llm


# Singleton
universal_llm = create_llm_from_env()
