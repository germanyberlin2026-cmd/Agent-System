ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_key text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_evidence jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tool_name text;
CREATE INDEX IF NOT EXISTS idx_tasks_dependencies ON tasks USING gin(depends_on);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL,
  change_reason text NOT NULL DEFAULT '',
  evaluator_score numeric(5,2),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prompt_versions_read" ON prompt_versions;
CREATE POLICY "prompt_versions_read" ON prompt_versions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "prompt_versions_write" ON prompt_versions;
CREATE POLICY "prompt_versions_write" ON prompt_versions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prompt_versions TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
