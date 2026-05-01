-- App-wide settings (LLM provider + model + key). Singleton row id="singleton".
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "id"           TEXT    NOT NULL DEFAULT 'singleton',
  "llmProvider"  TEXT    NOT NULL DEFAULT 'openrouter',
  "llmApiKey"    TEXT    NOT NULL DEFAULT '',
  "llmModel"     TEXT    NOT NULL DEFAULT 'google/gemini-2.5-flash',
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy"    TEXT,
  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
