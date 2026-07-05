<script>
	import { Pencil, Trash2, Plus, X, Loader2, Check, Copy, Power, ChevronDown } from '@lucide/svelte';
	import { agents, assignments, apiKeys, agentSkills, skills, addToast } from '../stores.js';
	import { createAgent, updateAgent, deleteAgent, fetchAgents, fetchPromptVersions, rollbackPromptVersion } from '../api.js';
	import { AGENT_ROLES, ROLE_ICONS, COMMON_EMOJIS } from '../constants.js';

	let showForm = $state(false);
	let editingAgent = $state(null);
	let promptVersions = $state([]);
	let saving = $state(false);
	let confirmDelete = $state(null);
	let showEmojiPicker = $state(false);

	const PREDEFINED_ROLES = Object.values(AGENT_ROLES);

	function emptyForm() {
		return {
			name: '', role: 'coder', customRole: '', icon: '💻',
			description: '', scope: '', system_prompt: '',
			input_schema_text: '{}', output_schema_text: '{}', change_reason: '',
			isCustomRole: false
		};
	}

	let formData = $state(emptyForm());

	function getRoleEmoji(role) {
		return ROLE_ICONS[role]?.emoji ?? ROLE_ICONS.custom.emoji;
	}

	function getEffectiveRole(fd) {
		return fd.isCustomRole ? (fd.customRole.trim() || 'custom') : fd.role;
	}

	function openCreate() {
		editingAgent = null;
		formData = emptyForm();
		promptVersions = [];
		showForm = true;
		showEmojiPicker = false;
	}

	async function openEdit(agent) {
		editingAgent = agent;
		const isPredefined = PREDEFINED_ROLES.includes(agent.role);
		formData = {
			name: agent.name,
			role: isPredefined ? agent.role : 'coder',
			customRole: isPredefined ? '' : agent.role,
			icon: agent.icon || getRoleEmoji(agent.role),
			isCustomRole: !isPredefined,
			description: agent.description || '',
			scope: agent.scope || '',
			system_prompt: agent.system_prompt || '',
			input_schema_text: JSON.stringify(agent.input_schema || {}, null, 2),
			output_schema_text: JSON.stringify(agent.output_schema || {}, null, 2),
			change_reason: ''
		};
		showForm = true;
		showEmojiPicker = false;
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
		const effectiveRole = getEffectiveRole(formData);
		if (!effectiveRole) { addToast('Role is required', 'error'); return; }
		saving = true;
		try {
			let input_schema, output_schema;
			try {
				input_schema = JSON.parse(formData.input_schema_text || '{}');
				output_schema = JSON.parse(formData.output_schema_text || '{}');
			} catch { throw new Error('Input and output contracts must be valid JSON'); }
			const payload = {
				name: formData.name, role: effectiveRole,
				icon: formData.icon,
				description: formData.description, scope: formData.scope,
				system_prompt: formData.system_prompt,
				input_schema, output_schema, change_reason: formData.change_reason
			};
			if (editingAgent) {
				await updateAgent(editingAgent.id, payload);
				addToast('Agent updated', 'success');
			} else {
				await createAgent(payload);
				addToast('Agent created', 'success');
			}
			agents.set(await fetchAgents());
			showForm = false;
		} catch (err) {
			addToast(`Failed to save: ${err.message}`, 'error');
		} finally { saving = false; }
	}

	async function handleDelete(id) {
		try {
			await deleteAgent(id);
			agents.set(await fetchAgents());
			confirmDelete = null;
			addToast('Agent deleted', 'success');
		} catch (err) { addToast(`Failed to delete: ${err.message}`, 'error'); }
	}

	async function duplicateAgent(agent) {
		try {
			await createAgent({ ...agent, name: `${agent.name} Copy` });
			agents.set(await fetchAgents());
			addToast('Agent duplicated', 'success');
		} catch (error) { addToast(`Could not duplicate: ${error.message}`, 'error'); }
	}

	async function toggleAgent(agent) {
		try {
			await updateAgent(agent.id, { is_active: !agent.is_active });
			agents.set(await fetchAgents());
			addToast(agent.is_active ? 'Agent disabled' : 'Agent enabled', 'success');
		} catch (error) { addToast(`Could not update: ${error.message}`, 'error'); }
	}

	function modelFor(agentId) {
		const a = $assignments.find(item => item.agent_id === agentId);
		const k = $apiKeys.find(item => item.id === a?.api_key_id);
		return a ? `${k?.label || k?.provider || 'provider'} / ${a.model_id}` : 'No model assigned';
	}

	function skillsFor(agentId) {
		const ids = $agentSkills.filter(item => item.agent_id === agentId).map(item => item.skill_id);
		return $skills.filter(s => ids.includes(s.id));
	}

	function agentIcon(agent) {
		if (agent.icon) return agent.icon;
		return getRoleEmoji(agent.role);
	}

	function selectEmoji(emoji) {
		formData.icon = emoji;
		showEmojiPicker = false;
	}

	function onRoleTabChange(isCustom) {
		formData.isCustomRole = isCustom;
		if (!isCustom) {
			formData.icon = getRoleEmoji(formData.role);
		}
	}

	$effect(() => {
		if (!formData.isCustomRole) {
			formData.icon = getRoleEmoji(formData.role);
		}
	});
</script>

<!-- Agent form modal -->
{#if showForm}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (showForm = false)}
		onkeydown={(e) => e.key === 'Escape' && (showForm = false)}
	>
		<div class="modal slide-up agent-modal">
			<div class="modal-header">
				<div class="modal-title">
					{#if editingAgent}<Pencil size={14} />{:else}<Plus size={14} />{/if}
					<span>{editingAgent ? `Edit: ${editingAgent.name}` : 'New Agent'}</span>
				</div>
				<button class="close-btn" onclick={() => showForm = false}><X size={13} /></button>
			</div>

			<div class="modal-body">

				<!-- Role type tabs -->
				<div class="field-group">
					<div class="label">Role type</div>
					<div class="role-tabs">
						<button
							class="role-tab {!formData.isCustomRole ? 'active' : ''}"
							onclick={() => onRoleTabChange(false)}
						>Predefined role</button>
						<button
							class="role-tab {formData.isCustomRole ? 'active' : ''}"
							onclick={() => onRoleTabChange(true)}
						>Custom role</button>
					</div>
				</div>

				{#if !formData.isCustomRole}
					<!-- Predefined role grid -->
					<div class="field-group">
						<div class="label">Select role</div>
						<div class="role-grid">
							{#each PREDEFINED_ROLES as role}
								<button
									class="role-option {formData.role === role ? 'selected' : ''}"
									onclick={() => { formData.role = role; formData.icon = getRoleEmoji(role); }}
								>
									<span class="role-emoji">{getRoleEmoji(role)}</span>
									<span class="role-opt-name">{role}</span>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<!-- Custom role fields -->
					<div class="field-group">
						<div class="label">Custom role name</div>
						<input
							class="input"
							bind:value={formData.customRole}
							placeholder="e.g. security-auditor, data-analyst, qa-engineer"
						/>
						<div class="field-hint">Lowercase, hyphen-separated. This becomes the agent's role identifier.</div>
					</div>

					<!-- Emoji icon picker -->
					<div class="field-group">
						<div class="label">Icon</div>
						<div class="icon-picker-row">
							<button class="icon-preview-btn" onclick={() => showEmojiPicker = !showEmojiPicker}>
								<span class="icon-preview-emoji">{formData.icon}</span>
								<span>Change icon</span>
								<ChevronDown size={13} />
							</button>
							<span class="field-hint">Appears in agent cards and pipeline view.</span>
						</div>
						{#if showEmojiPicker}
							<div class="emoji-grid">
								{#each COMMON_EMOJIS as emoji}
									<button
										class="emoji-option {formData.icon === emoji ? 'selected' : ''}"
										onclick={() => selectEmoji(emoji)}
										title={emoji}
									>{emoji}</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Basic fields -->
				<div class="form-row-2">
					<div class="field-group">
						<label class="label" for="agent-name">Name</label>
						<input id="agent-name" class="input" bind:value={formData.name} placeholder="e.g. Frontend Coder" />
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

				<!-- Contracts -->
				<div class="form-row-2">
					<div class="field-group">
						<label class="label" for="agent-input">Input Contract (JSON)</label>
						<textarea id="agent-input" class="input prompt-textarea" rows="5" bind:value={formData.input_schema_text}></textarea>
					</div>
					<div class="field-group">
						<label class="label" for="agent-output">Output Contract (JSON)</label>
						<textarea id="agent-output" class="input prompt-textarea" rows="5" bind:value={formData.output_schema_text}></textarea>
					</div>
				</div>

				<!-- System prompt -->
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
						placeholder="You are a specialized {getEffectiveRole(formData)} agent. Your role is to..."
					></textarea>
				</div>

				{#if editingAgent}
					<div class="field-group">
						<label class="label" for="agent-change-reason">Change Reason</label>
						<input id="agent-change-reason" class="input" bind:value={formData.change_reason} placeholder="Why this prompt or contract changed" />
					</div>
				{/if}

				<!-- Prompt version history -->
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
						<Loader2 size={13} class="spin" /> Saving…
					{:else if editingAgent}
						<Check size={13} /> Update Agent
					{:else}
						<Plus size={13} /> Create Agent
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirm modal -->
{#if confirmDelete}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && (confirmDelete = null)}
		onkeydown={(e) => e.key === 'Escape' && (confirmDelete = null)}
	>
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
			<div class="empty-state-icon">🤖</div>
			<div class="empty-state-title">No agents yet</div>
			<div class="empty-state-desc">Create your first agent. You'll need at least an orchestrator and a coder agent.</div>
		</div>
	{:else}
		<div class="agents-list">
			{#each $agents as agent (agent.id)}
				<details class="agent-row">
					<summary class="agent-summary">
						<div class="agent-icon-wrap">
							<span class="agent-emoji">{agentIcon(agent)}</span>
						</div>
						<div class="agent-info">
							<span class="agent-name">{agent.name}</span>
							<span class="agent-role-tag">{agent.role}</span>
						</div>
						<div class="agent-meta">
							<span class="badge {agent.is_active ? 'badge-green' : 'badge-dim'}">{agent.is_active ? 'Active' : 'Disabled'}</span>
							<span class="meta-item">{modelFor(agent.id)}</span>
							<span class="meta-item">{skillsFor(agent.id).length} skills</span>
						</div>
						<div class="agent-actions" role="none" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
							<button class="icon-btn" onclick={() => openEdit(agent)} title="Edit agent"><Pencil size={13} /></button>
							<button class="icon-btn" onclick={() => duplicateAgent(agent)} title="Duplicate"><Copy size={13} /></button>
							<button class="icon-btn" onclick={() => toggleAgent(agent)} title={agent.is_active ? 'Disable' : 'Enable'}><Power size={13} /></button>
							<button class="icon-btn danger" onclick={() => confirmDelete = agent} title="Delete"><Trash2 size={13} /></button>
						</div>
					</summary>

					<div class="agent-detail">
						<div class="detail-grid">
							<div>
								<span class="eyebrow">Assigned model</span>
								<strong>{modelFor(agent.id)}</strong>
							</div>
							<div>
								<span class="eyebrow">Active skills</span>
								<strong>{skillsFor(agent.id).length}</strong>
							</div>
							<div>
								<span class="eyebrow">Prompt</span>
								<strong>{agent.system_prompt ? 'Configured' : 'Not set'}</strong>
							</div>
							{#if agent.scope}
								<div>
									<span class="eyebrow">Scope</span>
									<strong>{agent.scope}</strong>
								</div>
							{/if}
						</div>

						{#if agent.description}
							<p class="detail-desc">{agent.description}</p>
						{/if}

						{#if agent.system_prompt}
							<pre class="detail-prompt">{agent.system_prompt.slice(0, 300)}{agent.system_prompt.length > 300 ? '…' : ''}</pre>
						{/if}

						{#if skillsFor(agent.id).length}
							<div class="detail-skills">
								<span class="eyebrow">Assigned skills</span>
								<div class="tag-list">
									{#each skillsFor(agent.id) as skill}
										<span class="tag">{skill.name} · v{skill.version}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</details>
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

	/* Agents accordion list */
	.agents-list {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border-default);
		border-radius: 12px;
		overflow: hidden;
	}
	.agent-row {
		border-bottom: 1px solid var(--color-border-subtle);
	}
	.agent-row:last-child { border-bottom: none; }
	.agent-row summary { list-style: none; }
	.agent-row summary::-webkit-details-marker { display: none; }

	.agent-summary {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		cursor: pointer;
		transition: background 0.15s ease;
		background: var(--color-surface-elevated);
	}
	.agent-summary:hover { background: var(--color-surface-subtle); }
	.agent-row[open] > .agent-summary { background: var(--color-background-subtle); }

	.agent-icon-wrap {
		width: 36px;
		height: 36px;
		border-radius: 9px;
		background: var(--color-background-muted);
		border: 1px solid var(--color-border-default);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.agent-emoji { font-size: 1.125rem; line-height: 1; }

	.agent-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.agent-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}
	.agent-role-tag {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.agent-meta {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-shrink: 0;
	}
	.meta-item {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.agent-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.agent-detail {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1rem 1rem 1rem 3.5rem;
		background: var(--color-surface-subtle);
		border-top: 1px solid var(--color-border-subtle);
	}
	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
	}
	.detail-grid > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.detail-grid strong {
		font-size: 0.8125rem;
		color: var(--color-text-primary);
		font-weight: 600;
	}
	.detail-desc {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin: 0;
	}
	.detail-prompt {
		font-size: 0.72rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		background: var(--color-surface-default);
		border: 1px solid var(--color-border-default);
		border-radius: 6px;
		padding: 0.625rem 0.75rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}
	.detail-skills { display: flex; flex-direction: column; gap: 0.375rem; }

	/* Icon button */
	.icon-btn {
		width: 28px; height: 28px;
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
	.icon-btn:hover { background: var(--color-surface-subtle); color: var(--color-text-primary); border-color: var(--color-border-strong); }
	.icon-btn.danger:hover { background: color-mix(in srgb, var(--color-status-danger-default) 10%, transparent); color: var(--color-status-danger-default); border-color: color-mix(in srgb, var(--color-status-danger-default) 30%, transparent); }

	/* Modal */
	.agent-modal { max-width: 700px; width: 95vw; }
	.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.125rem 1.25rem; border-bottom: 1px solid var(--color-border-default); }
	.modal-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.03em; }
	.close-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--color-border-default); background: transparent; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.close-btn:hover { background: var(--color-surface-subtle); color: var(--color-text-primary); }
	.modal-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; max-height: 72vh; overflow-y: auto; }
	.modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.25rem; border-top: 1px solid var(--color-border-default); }

	/* Role tabs */
	.role-tabs {
		display: flex;
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		overflow: hidden;
		width: fit-content;
	}
	.role-tab {
		padding: 0.375rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		transition: all 0.15s ease;
	}
	.role-tab.active {
		background: var(--color-action-primary);
		color: var(--color-action-primary-text);
	}
	.role-tab:not(.active):hover { background: var(--color-surface-subtle); color: var(--color-text-primary); }

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
		padding: 0.625rem 0.25rem;
		border-radius: 8px;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.role-option:hover { border-color: var(--color-border-strong); background: var(--color-background-muted); }
	.role-option.selected {
		background: color-mix(in srgb, var(--color-action-primary) 10%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 40%, transparent);
	}
	.role-emoji { font-size: 1.25rem; line-height: 1; }
	.role-opt-name {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}
	.role-option.selected .role-opt-name { color: var(--color-action-primary); }

	/* Custom icon picker */
	.icon-picker-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.icon-preview-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		background: var(--color-surface-subtle);
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		transition: all 0.15s ease;
	}
	.icon-preview-btn:hover { border-color: var(--color-border-strong); }
	.icon-preview-emoji { font-size: 1.25rem; line-height: 1; }

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 0.25rem;
		padding: 0.75rem;
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		margin-top: 0.25rem;
	}
	.emoji-option {
		font-size: 1.25rem;
		padding: 0.25rem;
		border-radius: 6px;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		text-align: center;
		line-height: 1;
		transition: all 0.12s ease;
	}
	.emoji-option:hover { background: var(--color-background-muted); border-color: var(--color-border-default); }
	.emoji-option.selected { background: color-mix(in srgb, var(--color-action-primary) 12%, transparent); border-color: color-mix(in srgb, var(--color-action-primary) 35%, transparent); }

	/* Form fields */
	.field-group { display: flex; flex-direction: column; gap: 0.375rem; }
	.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	.field-hint { font-size: 0.72rem; color: var(--color-text-muted); }
	.prompt-textarea { font-family: var(--font-mono); font-size: 0.8rem; }
	.char-count { font-size: 0.625rem; font-family: var(--font-mono); color: var(--color-text-disabled); margin-left: auto; }
	.prompt-header { display: flex; align-items: center; }

	/* Version pills */
	.version-pills { display: flex; flex-wrap: wrap; gap: 0.375rem; }
	.version-pill { font-size: 0.7rem; font-weight: 500; font-family: var(--font-mono); padding: 0.25rem 0.625rem; border-radius: 100px; background: var(--color-surface-subtle); border: 1px solid var(--color-border-default); color: var(--color-text-secondary); cursor: pointer; display: flex; align-items: center; gap: 0.25rem; }
	.version-pill:hover { border-color: var(--color-border-inverse); }
	.version-pill.active { background: color-mix(in srgb, var(--color-action-primary) 10%, transparent); border-color: color-mix(in srgb, var(--color-action-primary) 30%, transparent); color: var(--color-action-primary-hover); }
	.v-dot { font-size: 0.6rem; opacity: 0.7; }

	/* Confirm dialog */
	.confirm-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; }
	.confirm-title { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); text-align: center; margin-top: 0.25rem; }
	.confirm-desc { font-size: 0.8125rem; color: var(--color-text-secondary); text-align: center; line-height: 1.5; }
	.confirm-actions { display: flex; justify-content: center; gap: 0.75rem; margin-top: 0.75rem; }
	.empty-state-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
</style>
