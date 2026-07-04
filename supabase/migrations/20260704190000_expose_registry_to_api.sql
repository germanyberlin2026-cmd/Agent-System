-- Repair API visibility after registry tables were created from the SQL editor.
-- Safe to run repeatedly. It does not delete or duplicate data.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $repair$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'skills',
    'agent_skills',
    'prompt_versions',
    'system_prompts',
    'provider_models'
  ]
  LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO anon, authenticated, service_role',
        relation_name
      );
    END IF;
  END LOOP;
END
$repair$;

-- Force PostgREST to discover tables created by earlier SQL Editor runs.
NOTIFY pgrst, 'reload schema';

