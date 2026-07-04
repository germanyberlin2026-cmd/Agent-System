import { json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function parseSkillMarkdown(markdown) {
	const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
	if (!match) throw new Error('SKILL.md requires YAML frontmatter enclosed by ---');
	const metadata = {};
	for (const line of match[1].split(/\r?\n/)) {
		const separator = line.indexOf(':');
		if (separator < 1) continue;
		metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
	}
	if (!metadata.name || !metadata.description) throw new Error('SKILL.md frontmatter requires name and description');
	if (!/^[a-z0-9-]{1,64}$/.test(metadata.name)) throw new Error('Skill name must use lowercase letters, digits and hyphens');
	const instructions = match[2].trim();
	if (!instructions) throw new Error('SKILL.md instruction body is empty');
	return { name: metadata.name, description: metadata.description, instructions };
}

export async function POST({ request, url }) {
	try {
		if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Markdown import is localhost-only');
		const { file_path, markdown } = await request.json();
		let source = markdown;
		let sourcePath = null;
		if (file_path) {
			if (!path.isAbsolute(file_path) || path.extname(file_path).toLowerCase() !== '.md') throw new Error('Provide an absolute .md file path');
			sourcePath = path.resolve(file_path);
			source = await readFile(sourcePath, 'utf8');
		}
		if (typeof source !== 'string' || source.length > 256000) throw new Error('Markdown source is missing or too large');
		return json({ ...parseSkillMarkdown(source), source_type: file_path ? 'markdown_file' : 'markdown_text', source_path: sourcePath });
	} catch (error) {
		return json({ error: error.message }, { status: 400 });
	}
}
