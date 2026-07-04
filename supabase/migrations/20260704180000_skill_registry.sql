CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  PRIMARY KEY(agent_id, skill_id)
);
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skills_crud" ON skills;
CREATE POLICY "skills_crud" ON skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "agent_skills_crud" ON agent_skills;
CREATE POLICY "agent_skills_crud" ON agent_skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO skills (name,description,instructions,input_schema,output_schema,allowed_tools,success_criteria) VALUES
('project-scan','Grounded project discovery','Inspect only real filesystem evidence. Ignore generated/vendor directories and return compact context.','{"project_root":"string"}','{"file_tree":"object","tech_stack":"array"}','["filesystem.read","filesystem.search"]','["No invented files","Compact context"]'),
('safe-file-edit','Safe project file mutation','Use project-relative paths and exact unique search/replace edits. Preserve unrelated content.','{"files":"array"}','{"evidence":"array"}','["filesystem.read","filesystem.write"]','["Paths remain inside project","Every mutation has evidence"]'),
('svelte-ui','SvelteKit UI implementation','Follow Svelte 5 conventions, existing design tokens, accessibility, responsive layout, and component boundaries. Use runes only in .svelte or .svelte.js/.svelte.ts files; never place $state or $effect in ordinary .js/.ts modules. Require both build verification and an SSR GET smoke test.','{"task":"object","sources":"array"}','{"files":"array","summary":"string"}','["filesystem.read","filesystem.write"]','["Svelte build passes","SSR GET returns 2xx","No hydration errors"]'),
('apple-design','Apple-inspired interface design','Use restrained hierarchy, system typography, consistent radii, subtle materials, strong spacing, and accessible contrast. Preserve product identity; do not blindly copy Apple.','{"requirements":"string","current_ui":"object"}','{"decisions":"array","files":"array"}','["filesystem.read","filesystem.write"]','["Consistent tokens","Accessible contrast","Responsive layout"]'),
('test-runner','Deterministic project verification','Run the configured test command or direct framework build. Report actual command, status and output only.','{"project_root":"string"}','{"success":"boolean","command":"string","output":"string"}','["terminal.test","terminal.build"]','["Actual process exit status recorded"]'),
('code-review','Evidence-based code review','Review applied changes and deterministic verification evidence. Findings require severity and concrete file reference.','{"changes":"object","verification":"object"}','{"approved":"boolean","findings":"array"}','["filesystem.read"]','["No invented findings"]'),
('prompt-audit','Agent prompt quality audit','Evaluate role, context, constraints, tool policy, output schema and success criteria. Return database-ready updates.','{"agents":"array"}','{"agent_updates":"array"}','["database.read","database.write"]','["Every update targets an existing agent"]'),
('database-migration','Safe Supabase migration design','Create idempotent SQL with constraints, indexes, RLS and repeat-safe policies.','{"schema":"object"}','{"files":"array"}','["filesystem.read","filesystem.write","database.read"]','["Migration is idempotent","RLS is explicit"]'),
('debug-runtime','Runtime failure diagnosis','Use concrete logs to isolate root cause before proposing the smallest fix.','{"error":"string","context":"object"}','{"root_cause":"string","fix":"object"}','["filesystem.read","terminal.build"]','["Root cause cites evidence"]'),
('documentation','Verified change documentation','Document only applied changes and verified behavior.','{"changes":"object","verification":"object"}','{"documentation":"object"}','["filesystem.read"]','["No unverified claims"]')
ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description,instructions=EXCLUDED.instructions,input_schema=EXCLUDED.input_schema,output_schema=EXCLUDED.output_schema,allowed_tools=EXCLUDED.allowed_tools,success_criteria=EXCLUDED.success_criteria,updated_at=now();

INSERT INTO agent_skills(agent_id,skill_id,priority)
SELECT a.id,s.id,100 FROM agents a JOIN skills s ON
 (a.role='scanner' AND s.name='project-scan') OR
 (a.role='architect' AND s.name IN ('svelte-ui','apple-design')) OR
 (a.role='coder' AND s.name IN ('safe-file-edit','svelte-ui','database-migration')) OR
 (a.role='tester' AND s.name='test-runner') OR
 (a.role='reviewer' AND s.name='code-review') OR
 (a.role='debugger' AND s.name='debug-runtime') OR
 (a.role='documenter' AND s.name='documentation') OR
 (a.role='orchestrator' AND s.name='prompt-audit')
ON CONFLICT(agent_id,skill_id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skills, public.agent_skills TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
