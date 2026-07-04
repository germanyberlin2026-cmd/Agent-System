import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

if (!SUPABASE_URL || SUPABASE_URL === 'https://placeholder.supabase.co') {
	throw new Error(
		'VITE_SUPABASE_URL is not set. Create a .env file in your project root:\n' +
		'VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
		'VITE_SUPABASE_ANON_KEY=your-anon-key'
	);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		persistSession: false,
		autoRefreshToken: false
	}
});
