function getEnv(name) {
	if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
		return import.meta.env[name];
	}
	if (typeof process !== 'undefined' && process.env && process.env[name]) {
		return process.env[name];
	}
	return undefined;
}

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error(
		'Missing Supabase environment variables. Create a .env file in the project root with:\n' +
		'VITE_SUPABASE_URL=your_project_url\n' +
		'VITE_SUPABASE_ANON_KEY=your_anon_key'
	);
}
