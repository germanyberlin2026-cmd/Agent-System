import { json } from '@sveltejs/kit';
import { executeBackend } from '$lib/server/llm-backend.js';

export async function POST({ params, request }) {
	try {
		return json(await executeBackend(params.name, await request.json()));
	} catch (error) {
		return json({ error: error.message }, { status: 500 });
	}
}
