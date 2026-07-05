-- Add icon column to agents table (emoji or short identifier for custom agents)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS icon text DEFAULT '';

-- Add base_url column to api_keys table (for Ollama and custom OpenAI-compatible endpoints)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS base_url text DEFAULT '';
