<script>
	import { FolderOpen, Search, CheckCircle, XCircle, Folder, Link, Loader2, Plus, X } from '@lucide/svelte';
	import { projects, activeProject, knowledgeCache, addToast } from '../stores.js';
	import { createProject, deleteProject, fetchProjects, updateProject, fetchKnowledge } from '../api.js';
	import { runScanner } from '../orchestrator.js';
	import StatusBadge from './StatusBadge.svelte';

	let sourcePath = $state('');
	let sourceType = $state('local');
	let projectName = $state('');
	let creating = $state(false);
	let scanning = $state(false);
	let showForm = $state(false);

	async function handleCreate() {
		if (!sourcePath.trim()) {
			addToast('Project path or URL is required', 'error');
			return;
		}
		creating = true;
		try {
			const isUrl = sourcePath.trim().startsWith('http') || sourcePath.trim().includes('github.com');
			const type = isUrl ? 'git' : sourceType;
			const name = projectName.trim() || sourcePath.trim().split('/').pop() || 'Untitled';
			const project = await createProject({ name, source_path: sourcePath.trim(), source_type: type });
			const all = await fetchProjects();
			projects.set(all);
			activeProject.set(project);
			sourcePath = '';
			projectName = '';
			showForm = false;
			addToast(`Project "${name}" created`, 'success');
		} catch (err) {
			addToast(`Failed to create project: ${err.message}`, 'error');
		} finally {
			creating = false;
		}
	}

	async function handleSelectProject(project) {
		activeProject.set(project);
		const knowledge = await fetchKnowledge(project.id);
		knowledgeCache.set(knowledge);
	}

	async function handleScan(project) {
		scanning = true;
		try {
			const knowledge = await runScanner(project);
			knowledgeCache.set(knowledge);
			const all = await fetchProjects();
			projects.set(all);
			const updated = all.find(p => p.id === project.id);
			if (updated) activeProject.set(updated);
			addToast('Project scanned successfully', 'success');
		} catch (err) {
			addToast(`Scan failed: ${err.message}`, 'error');
		} finally {
			scanning = false;
		}
	}

	async function handleDelete(id) {
		try {
			await deleteProject(id);
			const all = await fetchProjects();
			projects.set(all);
			if ($activeProject?.id === id) activeProject.set(null);
			addToast('Project deleted', 'success');
		} catch (err) {
			addToast(`Failed to delete: ${err.message}`, 'error');
		}
	}

	const scanIcon = {
		idle: FolderOpen,
		scanning: Search,
		done: CheckCircle,
		failed: XCircle
	};
</script>

<div class="section-block">
	<div class="section-header">
		<div class="section-icon"><FolderOpen size={16} strokeWidth={2.5} /></div>
		<div>
			<div class="section-title">Projects</div>
		</div>
		<button class="btn btn-primary btn-sm ml-auto" onclick={() => showForm = !showForm}>
			{#if showForm}
				<X size={13} strokeWidth={2} /> Cancel
			{:else}
				<Plus size={13} strokeWidth={2} /> New
			{/if}
		</button>
	</div>

	{#if showForm}
		<div class="add-form fade-in-up">
			<div class="form-row">
				<div class="form-field">
					<label class="label" for="proj-name">Name</label>
					<input id="proj-name" class="input" bind:value={projectName} placeholder="My Project" />
				</div>
				<div class="form-field">
					<label class="label" for="proj-type">Type</label>
					<select id="proj-type" class="input" bind:value={sourceType}>
						<option value="local">Local Directory</option>
						<option value="git">Git Repository</option>
					</select>
				</div>
			</div>
			<div class="form-field">
				<label class="label" for="proj-path">Path / URL</label>
				<input
					id="proj-path"
					class="input"
					bind:value={sourcePath}
					placeholder="/path/to/project or https://github.com/user/repo"
					onkeydown={(e) => e.key === 'Enter' && handleCreate()}
				/>
			</div>
			<button class="btn btn-primary w-full" onclick={handleCreate} disabled={creating}>
				{#if creating}
					<Loader2 size={14} strokeWidth={2} class="spin" /> Creating...
				{:else}
					<Plus size={14} strokeWidth={2} /> Add Project
				{/if}
			</button>
		</div>
	{/if}

	{#if $projects.length === 0}
		<div class="empty-state" style="padding: 2rem 1rem;">
			<div class="empty-state-icon"><FolderOpen size={40} strokeWidth={1.5} /></div>
			<div class="empty-state-title">No projects yet</div>
			<div class="empty-state-desc">Add a project to get started with the workflow</div>
		</div>
	{:else}
		<div class="project-list">
			{#each $projects as project (project.id)}
				<div
					class="project-card {$activeProject?.id === project.id ? 'selected' : ''}"
					role="button"
					tabindex="0"
					onclick={() => handleSelectProject(project)}
					onkeydown={(e) => e.key === 'Enter' && handleSelectProject(project)}
				>
					<div class="project-main">
						<span class="project-scan-icon" style="color: var(--color-text-muted)">
							<svelte:component this={scanIcon[project.scan_status] || FolderOpen} size={15} strokeWidth={2} />
						</span>
						<div class="project-info">
							<div class="project-name">{project.name}</div>
							<div class="project-path">{project.source_path}</div>
						</div>
						{#if $activeProject?.id === project.id}
							<span class="active-pill">Active</span>
						{/if}
					</div>
					<div class="project-actions" role="none" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
						<StatusBadge status={project.scan_status} />
						<button
							class="btn btn-ghost btn-sm"
							style="gap: 0.25rem"
							onclick={() => handleScan(project)}
							disabled={scanning}
						>
							{#if scanning && $activeProject?.id === project.id}
								<Loader2 size={11} strokeWidth={2} class="spin" />
							{:else}
								<Search size={11} strokeWidth={2} />
							{/if}
							Scan
						</button>
						<button
							class="btn btn-danger btn-sm"
							onclick={() => handleDelete(project.id)}
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.section-block {
		padding: 1.125rem;
		border-bottom: 1px solid var(--color-border-default);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.add-form {
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 10px;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
	}
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.w-full { width: 100%; }

	.project-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.project-card {
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 10px;
		padding: 0.75rem 0.875rem;
		cursor: pointer;
		transition: all 0.18s ease;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.project-card:hover {
		border-color: var(--color-border-inverse);
		background: var(--color-surface-elevated);
	}
	.project-card.selected {
		border-color: color-mix(in srgb, var(--color-action-primary) 35%, transparent);
		background: color-mix(in srgb, var(--color-action-primary) 5%, transparent);
	}

	.project-main {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}
	.project-scan-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.project-info {
		flex: 1;
		min-width: 0;
	}
	.project-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.project-path {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.125rem;
	}
	.active-pill {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-action-primary-hover);
		background: color-mix(in srgb, var(--color-action-primary) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-action-primary) 25%, transparent);
		border-radius: 100px;
		padding: 0.15rem 0.5rem;
		flex-shrink: 0;
	}
	.project-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.ml-auto { margin-left: auto; }
</style>
