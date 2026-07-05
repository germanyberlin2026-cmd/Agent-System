-- Versioned, execution-grade skill registry.
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT '';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS when_to_use text NOT NULL DEFAULT '';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS when_not_to_use text NOT NULL DEFAULT '';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS examples jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS changelog text NOT NULL DEFAULT '';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'manual';
ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS input_schema jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS output_schema jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.skills ADD CONSTRAINT skills_status_check CHECK (status IN ('draft','active','disabled','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.skill_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(skill_id, version)
);

ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skill_versions_crud" ON public.skill_versions;
CREATE POLICY "skill_versions_crud" ON public.skill_versions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.skill_versions(skill_id, version, snapshot, change_reason)
SELECT id, version, to_jsonb(skills), 'Initial registry snapshot' FROM public.skills
ON CONFLICT(skill_id, version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_skill_versioned(
  p_skill_id uuid,
  p_updates jsonb,
  p_change_reason text DEFAULT 'Skill updated'
) RETURNS public.skills
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_skill public.skills; next_version integer; updated_skill public.skills;
BEGIN
  SELECT * INTO current_skill FROM public.skills WHERE id = p_skill_id FOR UPDATE;
  IF current_skill.id IS NULL THEN RAISE EXCEPTION 'Skill not found'; END IF;
  next_version := current_skill.version + 1;
  INSERT INTO public.skill_versions(skill_id, version, snapshot, change_reason)
  VALUES(current_skill.id, current_skill.version, to_jsonb(current_skill), p_change_reason)
  ON CONFLICT(skill_id, version) DO NOTHING;

  UPDATE public.skills SET
    name = COALESCE(p_updates->>'name', name),
    description = COALESCE(p_updates->>'description', description),
    category = COALESCE(p_updates->>'category', category),
    purpose = COALESCE(p_updates->>'purpose', purpose),
    when_to_use = COALESCE(p_updates->>'when_to_use', when_to_use),
    when_not_to_use = COALESCE(p_updates->>'when_not_to_use', when_not_to_use),
    instructions = COALESCE(p_updates->>'instructions', instructions),
    allowed_tools = COALESCE(p_updates->'allowed_tools', allowed_tools),
    success_criteria = COALESCE(p_updates->'success_criteria', success_criteria),
    input_schema = COALESCE(p_updates->'input_schema', input_schema),
    output_schema = COALESCE(p_updates->'output_schema', output_schema),
    examples = COALESCE(p_updates->'examples', examples),
    changelog = COALESCE(p_updates->>'changelog', changelog),
    status = COALESCE(p_updates->>'status', status),
    source_format = COALESCE(p_updates->>'source_format', source_format),
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    version = next_version,
    updated_at = now()
  WHERE id = p_skill_id RETURNING * INTO updated_skill;
  RETURN updated_skill;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_versions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_skill_versioned(uuid,jsonb,text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
