import { json } from '@sveltejs/kit';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { exec as execCommand } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execCommand);

function safeRoot(root, hostname) {
	if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) throw new Error('Tools are localhost-only');
	if (!root || !path.isAbsolute(root)) throw new Error('Invalid project root');
	return path.resolve(root);
}

function safePath(root, relative) {
	const target = path.resolve(root, relative);
	if (target !== root && !target.startsWith(root + path.sep)) throw new Error(`Path escapes project: ${relative}`);
	if (relative.includes('.env') || relative.startsWith('.git/')) throw new Error(`Protected path: ${relative}`);
	return target;
}

export async function POST({ request, url }) {
	try {
		const body = await request.json();
		const root = safeRoot(body.project_root, url.hostname);
		if (body.action === 'apply_files') {
			const files = Array.isArray(body.files) ? body.files : [];
			if (!files.length || files.length > 20) throw new Error('Expected 1-20 file changes');
			const evidence = [];
			for (const file of files) {
				if (!file?.path) throw new Error('Each file change needs a path');
				const target = safePath(root, file.path);
				const before = await readFile(target, 'utf8').catch(() => null);
				let content = file.content;
				if (typeof content !== 'string' && typeof file.search === 'string' && typeof file.replace === 'string') {
					if (before === null) throw new Error(`Cannot edit missing file: ${file.path}`);
					const matches = before.split(file.search).length - 1;
					if (matches !== 1) {
						return json({
							success: false,
							code: 'SEARCH_MISMATCH',
							error: `Expected exactly one search match in ${file.path}, found ${matches}`,
							path: file.path,
							matches,
							actual_content: before.slice(0, 16000),
							instruction: 'Inspect actual_content and return a corrected exact search/replace edit. Do not repeat the failed search.'
						}, { status: 409 });
					}
					content = before.replace(file.search, file.replace);
				}
				if (typeof content !== 'string') throw new Error('Each file change needs content or an exact search/replace pair');
				await mkdir(path.dirname(target), { recursive: true });
				await writeFile(target, content, 'utf8');
				evidence.push({ path: file.path, created: before === null, before_chars: before?.length || 0, after_chars: content.length });
			}
			return json({ success: true, action: 'apply_files', evidence });
		}
		if (body.action === 'read_files') {
			const requested = Array.isArray(body.paths) ? body.paths : [];
			if (!requested.length || requested.length > 12) throw new Error('Expected 1-12 file paths');
			const files = [];
			for (const relative of requested) {
				const target = safePath(root, relative);
				try {
					const content = await readFile(target, 'utf8');
					files.push({ path: relative, exists: true, content: content.slice(0, 24000), truncated: content.length > 24000 });
				} catch {
					files.push({ path: relative, exists: false, content: null, truncated: false });
				}
			}
			return json({ success: true, action: 'read_files', files });
		}
		if (body.action === 'verify') {
			const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
			const script = pkg.scripts?.test ? 'test' : pkg.devDependencies?.vite ? 'vite-build' : pkg.scripts?.build ? 'build' : null;
			if (!script) return json({ success: true, action: 'verify', skipped: true, reason: 'No test/build script' });
			const viteBinary = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
			const command = script === 'vite-build' ? `"${viteBinary}" build` : `npm run ${script}`;
			try {
				const { stdout, stderr } = await exec(command, { cwd: root, timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 });
				let runtime = null;
				if (url.origin.includes('127.0.0.1') || url.origin.includes('localhost')) {
					const response = await fetch(`${url.origin}/`, { signal: AbortSignal.timeout(10000) });
					const responseText = await response.text();
					runtime = { url: `${url.origin}/`, status: response.status, ok: response.ok };
					if (!response.ok) {
						return json({ success: false, action: 'verify', command, runtime, output: `SSR smoke test failed (${response.status}): ${responseText.slice(0, 4000)}` }, { status: 422 });
					}
				}
				return json({ success: true, action: 'verify', command, runtime, output: (stdout + stderr).slice(-12000) });
			} catch (error) {
				return json({ success: false, action: 'verify', command, output: `${error.message || ''}\n${error.stdout || ''}${error.stderr || ''}`.slice(-12000) }, { status: 422 });
			}
		}
		throw new Error('Unsupported tool action');
	} catch (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}
}
