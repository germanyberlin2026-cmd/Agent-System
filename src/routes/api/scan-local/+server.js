import { json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const IGNORED = new Set(['.git', 'node_modules', '.svelte-kit', 'dist', 'build', '.next', 'coverage']);
const TEXT_EXTENSIONS = new Set(['.js', '.ts', '.svelte', '.json', '.md', '.sql', '.py', '.go', '.rs', '.java', '.toml', '.yaml', '.yml']);
const MAX_FILES = 250;
const MAX_CONTENT_FILES = 6;
const MAX_FILE_CHARS = 4000;

export async function POST({ request, url }) {
	if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
		return json({ error: 'Local scanning is available only on localhost' }, { status: 403 });
	}
	const { project_path } = await request.json();
	if (!project_path || !path.isAbsolute(project_path)) {
		return json({ error: 'A valid absolute local path is required' }, { status: 400 });
	}

	const rootStat = await stat(project_path).catch(() => null);
	if (!rootStat?.isDirectory()) return json({ error: 'Local project directory was not found' }, { status: 404 });

	const files = [];
	async function walk(directory) {
		if (files.length >= MAX_FILES) return;
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			if (files.length >= MAX_FILES || IGNORED.has(entry.name) || entry.isSymbolicLink()) continue;
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(absolute);
			else files.push(path.relative(project_path, absolute).replaceAll('\\', '/'));
		}
	}
	await walk(project_path);

	const priority = (file) => /(^|\/)(package\.json|README\.md|vite\.config\.[jt]s|src\/routes\/layout\.css|src\/routes\/\+page\.svelte|src\/lib\/constants\.js)$/i.test(file);
	const readable = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))
		.sort((a, b) => Number(priority(b)) - Number(priority(a))).slice(0, MAX_CONTENT_FILES);
	const sourceFiles = [];
	for (const file of readable) {
		const content = await readFile(path.join(project_path, file), 'utf8').catch(() => null);
		if (content !== null) sourceFiles.push({ path: file, content: content.replaceAll('\0', '').slice(0, MAX_FILE_CHARS) });
	}

	const names = new Set(files.map((file) => file.toLowerCase()));
	const techStack = [];
	if (names.has('package.json')) techStack.push('JavaScript/TypeScript', 'Node.js');
	if ([...names].some((file) => file.endsWith('.svelte'))) techStack.push('SvelteKit');
	if (names.has('requirements.txt') || [...names].some((file) => file.endsWith('.py'))) techStack.push('Python');
	if (names.has('cargo.toml')) techStack.push('Rust');
	if (names.has('go.mod')) techStack.push('Go');

	const entryPoints = files.filter((file) => /(^|\/)(package\.json|README\.md|\+page\.svelte|index\.[jt]s|main\.py|main\.go)$/i.test(file)).slice(0, 20);
	return json({
		tech_stack: techStack.length ? [...new Set(techStack)] : ['Unknown'],
		entry_points: entryPoints,
		dependency_graph: { root: files.filter((file) => !file.includes('/')).slice(0, 50) },
		file_tree: { root: project_path, files, source_excerpts: sourceFiles, truncated: files.length >= MAX_FILES },
		documentation: sourceFiles.filter((file) => /(^|\/)README\.md$/i.test(file.path)).map((file) => ({ path: file.path, summary: file.content.slice(0, 500) })),
		raw_summary: `Scanned ${files.length} project files. Detected ${techStack.join(', ') || 'an unknown stack'}. ` +
			`Loaded ${sourceFiles.length} compact source excerpts. Entry points: ${entryPoints.slice(0, 8).join(', ')}.`
	});
}
