import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';

export const supabase = createClient(
	SUPABASE_URL || 'https://placeholder.supabase.co',
	SUPABASE_ANON_KEY || 'placeholder',
	{
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	}
);
