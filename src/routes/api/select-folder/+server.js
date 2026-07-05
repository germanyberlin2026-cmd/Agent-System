import { json } from '@sveltejs/kit';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export async function POST({ request }) {
	// The route is protected by an application-only header instead of brittle
	// hostname matching (localhost may be proxied or resolved differently).
	if (request.headers.get('x-kceva-local-action') !== 'select-folder') {
		return json({ error: 'Invalid local folder-selection request' }, { status: 403 });
	}
	if (process.platform !== 'win32') {
		return json({ error: 'Native folder selection is currently available on Windows only', fallback: true }, { status: 501 });
	}

	const script = [
		'Add-Type -AssemblyName System.Windows.Forms',
		'$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
		'$dialog.Description = "Select a project folder for Kceva Agent OS"',
		'$dialog.ShowNewFolderButton = $false',
		'$result = $dialog.ShowDialog()',
		'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $dialog.SelectedPath }'
	].join('; ');

	try {
		const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], {
			windowsHide: true,
			timeout: 120000,
			encoding: 'utf8'
		});
		const selectedPath = stdout.trim();
		if (!selectedPath) return json({ cancelled: true });
		return json({ path: selectedPath, name: path.basename(selectedPath) });
	} catch (error) {
		return json({ error: `Folder dialog failed: ${error.message}`, fallback: true }, { status: 500 });
	}
}
