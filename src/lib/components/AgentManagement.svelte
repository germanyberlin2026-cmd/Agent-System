<script>
	import { Pencil, Trash2, Plus, X, Loader2, Check, Search, Network, PenTool, Code2, TestTube, Microscope, FileText, Bug } from '@lucide/svelte';
	import { agents, addToast } from '../stores.js';
	import { createAgent, updateAgent, deleteAgent, fetchAgents, fetchPromptVersions, rollbackPromptVersion } from '../api.js';
	import { AGENT_ROLES } from '../constants.js';

	let showForm = $state(false);
	let editingAgent = $state(null);
	let promptVersions = $state([]);
	let formData = $state({ name: '', role: 'coder', description: '', scope: '', system_prompt: '' });
	let saving = $state(false);
	let confirmDelete = $state(null);

	const roleConfig = {
		scanner:      { icon: Search,    color: 'var(--color-role-scanner)', desc: 'Analyzes project structure and builds knowledge cache' },
		orchestrator: { icon: Network,   color: 'var(--color-role-orchestrator)', desc: 'Decomposes commands and routes tasks to worker agents' },
		architect:    { icon: PenTool,   color: 'var(--color-role-architect)', desc: 'Creates implementation plans and design decisions' },
		coder:        { icon: Code2,     color: 'var(--color-role-coder)', desc: 'Generates and modifies source code files' },
		tester:       { icon: TestTube,  color: 'var(--color-role-tester)', desc: 'Runs tests and validates correctness of code' },
		reviewer:     { icon: Microscope,color: 'var(--color-role-reviewer)', desc: 'Reviews output for quality, security, and correctness' },
		documenter:   { icon: FileText,  color: 'var(--color-role-documenter)', desc: 'Creates and updates documentation' },
		debugger:     { icon: Bug,       color: 'var(--color-role-debugger)', desc: 'Diagnoses and fixes bugs and errors' }
	};

	function openCreate() {
		editingAgent = null;
		formData = { name: '', role: 'coder', description: '', scope: '', system_prompt: '' };
		promptVersions = [];
		showForm = true;
	}

	async function openEdit(agent) {
		editingAgent = agent;
		formData = {
			name: agent.name,
			role: agent.role,
			description: agent.description || '',
			scope: agent.scope || '',
			system_prompt: agent.system_prompt || ''
		};
		showForm = true;
		promptVersions = await fetchPromptVersions(agent.id);
	}

	async function handleRollback(version) {
		await rollbackPromptVersion(editingAgent.id, version);
		const all = await fetchAgents();
		agents.set(all);
		const updated = all.find(a => a.id === editingAgent.id);
		formData.system_prompt = updated.system_prompt;
		promptVersions = await fetchPromptVersions(editingAgent.id);
		addToast(`Prompt rolled back to v${version}`, 'success');
	}

	async function handleSave() {
		if (!formData.name.trim()) { addToast('Agent name is required', 'error'); return; }
		saving = true;
		try {
			if (editingAgent) {
				await updateAgent(editingAgent.id, formData);
				addToast('Agent updated', 'success');
			} else {
				await createAgent(formData);
				addToast('Agent created', 'success');
			}
			const all = await fetchAgents();
			agents.set(all);
			showForm = false;
		} catch (err) {
			addToast(`Failed to save: ${err.message}`, 'error');
		} finally {
			saving = false;
		}
	}

	async function handleDelete(id) {
		try {
			await deleteAgent(id);
			const all = await fetchAgents();
			agents.set(all);
			confirmDelete = null;
			addToast('Agent deleted', 'success');
		} catch (err) {
			addToast(`Failed to delete: ${err.message}`, 'error');
		}
	}

	function getRoleCfg(role) {
		return roleConfig[role] || { icon: Code2, color: 'var(--color-role-architect)', desc: '' };
	}
</script>

<!-- Modal form -->
{#if showForm}
	<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (showForm = false)}>
		<div class="modal slide-up">
			<div class="modal-header">
				<div class="modal-title">
					{#if editingAgent}
						<Pencil size={14} strokeWidth={2} />
					{:else}
						<Plus size={14} strokeWidth={2} />
					{/if}
					<span>{editingAgent ? `Edit: ${editingAgent.name}` : 'New Agent'}</span>
				</div>
				<button class="close-btn" onclick={() => showForm = false}><X size={13} strokeWidth={2} /></button>
			</div>

			<div class="modal-body">
				<!-- Role selector -->
				<div class="field-group">
					<div class="label">Role</div>
					<div class="role-grid">
						{#each Object.entries(AGENT_ROLES) as [key, role]}
							{@const cfg = getRoleCfg(role)}
							<button
								class="role-option {formData.role === role ? 'selected' : ''}"
								onclick={() => formData.role = role}
							>
								<span class="role-opt-icon">
									<svelte:component this={cfg.icon} size={14} strokeWidth={1.75} />
								</span>
								<span class="role-opt-name">{role}</span>
							</button>
						{/each}
					</div>
					{#if getRoleCfg(formData.role).desc}
						<div class="role-desc">{getRoleCfg(formData.role).desc}</div>
					{/if}
				</div>

				<div class="form-row-2">
					<div class="field-group">
						<label class="label" for="agent-name">Name</label>
						<input id="agent-name" class="input" bind:value={formData.name} placeholder="e.g. Code Generator" />
					</div>
					<div class="field-group">
						<label class="label" for="agent-scope">Scope</label>
						<input id="agent-scope" class="input" bind:value={formData.scope} placeholder="e.g. Frontend code" />
					</div>
				</div>

				<div class="field-group">
					<label class="label" for="agent-description">Description</label>
					<input id="agent-description" class="input" bind:value={formData.description} placeholder="What this agent specializes in" />
				</div>

				<div class="field-group">
					<div class="prompt-header">
						<label class="label" for="agent-prompt">System Prompt</label>
						<span class="char-count">{formData.system_prompt.length} chars</span>
					</div>
					<textarea
						id="agent-prompt"
						class="input prompt-textarea"
						rows="6"
						bind:value={formData.system_prompt}
						placeholder="You are a specialized {formData.role} agent. Your role is to..."
					></textarea>
				</div>

				{#if editingAgent && promptVersions.length > 0}
					<div class="field-group">
						<div class="label">Prompt History</div>
						<div class="version-pills">
							{#each promptVersions as version}
								<button
									class="version-pill {version.is_active ? 'active' : ''}"
									onclick={() => handleRollback(version.version)}
								>
									v{version.version}
									{#if version.is_active}<span class="v-dot">● active</span>{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => showForm = false}>Cancel</button>
				<button class="btn btn-primary" onclick={handleSave} disabled={saving}>
					{#if saving}
						<Loader2 size={13} strokeWidth={2} class="spin" />
						Saving…
					{:else if editingAgent}
						<Check size={13} strokeWidth={2} />
						Update Agent
					{:else}
						<Plus size={13} strokeWidth={2} />
						Create Agent
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirm modal -->
{#if confirmDelete}
	<div class="modal-overlay" onclick={(e) => e.target === e.currentTarget && (confirmDelete = null)}>
		<div class="modal slide-up" style="max-width: 380px">
			<div class="modal-body" style="padding: 1.5rem">
				<div class="confirm-icon"><Trash2 size={28} strokeWidth={1.5} /></div>
				<div class="confirm-title">Delete Agent?</div>
				<div class="confirm-desc">This will permanently remove <strong>{confirmDelete.name}</strong> and all its configurations.</div>
				<div class="confirm-actions">
					<button class="btn btn-ghost" onclick={() => confirmDelete = null}>Cancel</button>
					<button class="btn btn-danger" onclick={() => handleDelete(confirmDelete.id)}>Delete</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Main content -->
<div class="agent-studio">
	<div class="studio-header">
		<div class="studio-count">{$agents.length} agents configured</div>
		<button class="btn btn-primary" onclick={openCreate}>
			<Plus size={13} strokeWidth={2.2} />
			New Agent
		</button>
	</div>

	{#if $agents.length === 0}
		<div class="empty-state" style="padding: 3rem 2rem">
					<div class="empty-state-icon"><Code2 size={40} strokeWidth={1.25} /></div>
			<div class="empty-state-title">No agents yet</div>
			<div class="empty-state-desc">Create your first agent to get started. You'll need at least an orchestrator and a coder agent.</div>
		</div>
	{:else}
		<div class="agents-grid">
			{#each $agents as agent (agent.id)}
				{@const cfg = getRoleCfg(agent.role)}
				<div class="agent-card" style="--agent-color: {cfg.color}">
					<div class="card-top">
						<div class="card-avatar">
							<span class="card-avatar-icon">
								<svelte:component this={cfg.icon} size={16} strokeWidth={1.75} />
							</span>
						</div>
						<div class="card-info">
							<div class="card-name">{agent.name}</div>
							<div class="card-role">{agent.role}</div>
						</div>
						<div class="card-actions">
							<button class="icon-btn" onclick={() => openEdit(agent)} title="Edit">
								<Pencil size={13} strokeWidth={1.75} />
							</button>
							<button class="icon-btn danger" onclick={() => confirmDelete = agent} title="Delete">
								<Trash2 size={13} strokeWidth={1.75} />
							</button>
						</div>
					</div>

					{#if agent.description}
						<div class="card-desc">{agent.description}</div>
					{/if}

					{#if agent.system_prompt}
						<div class="card-prompt">
							{agent.system_prompt.slice(0, 100)}{agent.system_prompt.length > 100 ? '...' : ''}
						</div>
					{/if}

					<div class="card-footer">
						<span class="badge badge-dim">{agent.role}</span>
						{#if agent.scope}
							<span class="scope-tag">{agent.scope}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.agent-studio {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.studio-count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.agents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.875rem;
	}

	/* Agent card */
	.agent-card {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-default);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}
	.agent-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--agent-color, var(--color-action-primary));
		opacity: 0.6;
	}
	.agent-card:hover {
		border-color: var(--color-border-inverse);
		background: var(--color-surface-subtle);
		transform: translateY(-1px);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--p-color-neutral-950) 20%, transparent);
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.card-avatar {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		border: 1px solid;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.card-avatar-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.card-info { flex: 1; min-width: 0; }
	.card-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.card-role {
		font-size: 0.675rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.1rem;
	}
	.card-actions {
		display: flex;
		gap: 0.25rem;
	}
	.icon-btn {
		width: 28px;
		height: 28px;
		border-radius: 7px;
		border: 1px solid var(--color-border-default);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}
	.icon-btn:hover {
		background: var(--color-surface-subtle);
		color: var(--color-text-primary);
		border-color: var(--color-border-strong);
	}
	.icon-btn.danger:hover {
		background: color-mix(in srgb, var(--color-status-danger-default) 10%, transparent);
		color: var(--color-status-danger-default);
		border-color: color-mix(in srgb, var(--color-status-danger-default) 30%, transparent);
	}

	.card-desc {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.card-prompt {
		font-size: 0.72rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 6px;
		padding: 0.5rem 0.625rem;
		line-height: 1.5;
	}

	.card-footer {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.scope-tag {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 5px;
		padding: 0.15rem 0.45rem;
	}

	/* Modal styles */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.125rem 1.25rem;
		border-bottom: 1px solid var(--color-border-default);
	}
	.modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.03em;
	}
	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: 7px;
		border: 1px solid var(--color-border-default);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}
	.close-btn:hover { background: var(--color-surface-subtle); color: var(--color-text-primary); }

	.modal-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-border-default);
	}

	/* Form fields */
	.field-group { display: flex; flex-direction: column; gap: 0.375rem; }
	.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	.char-count {
		font-size: 0.625rem;
		font-family: var(--font-mono);
		color: var(--color-text-disabled);
		margin-left: auto;
	}
	.prompt-header {
		display: flex;
		align-items: center;
	}
	.prompt-textarea { font-family: var(--font-mono); font-size: 0.8rem; }

	/* Role grid */
	.role-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.375rem;
	}
	.role-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.25rem;
		border-radius: 8px;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.role-option:hover { border-color: var(--color-border-strong); }
	.role-option.selected {
		background: color-mix(in srgb, var(--role-color) 10%, transparent);
		border-color: color-mix(in srgb, var(--role-color) 30%, transparent);
	}
	.role-opt-icon { font-size: 1.125rem; }
	.role-opt-name {
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}
	.role-option.selected .role-opt-name { color: var(--role-color); }
	.role-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		line-height: 1.4;
		padding: 0.375rem 0.5rem;
		background: var(--color-surface-subtle);
		border-radius: 6px;
		border: 1px solid var(--color-border-default);
	}

	/* Version pills */
	.version-pills { display: flex; flex-wrap: wrap; gap: 0.375rem; }
	.version-pill {
		font-size: 0.7rem;
		font-weight: 500;
		font-family: var(--font-mono);
		padding: 0.25rem 0.625rem;
		border-radius: 100px;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.version-pill:hover { border-color: var(--color-border-inverse); }
	.version-pill.active {
		background: color-mix(in srgb, var(--color-action-primary) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 30%, transparent);
		color: var(--color-action-primary-hover);
	}
	.v-dot { font-size: 0.6rem; opacity: 0.7; }

	/* Confirm dialog */
	.confirm-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
	}
	.confirm-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-primary);
		text-align: center;
		margin-top: 0.25rem;
	}
	.confirm-desc {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		text-align: center;
		line-height: 1.5;
	}
	.confirm-actions {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
</style>
