<script>
	import { Zap, Plus, X, Pencil, FileCode2, Loader2, AlertTriangle, Circle, ChevronDown } from '@lucide/svelte';
	import { skills, agentSkills, agents, addToast } from '../stores.js';
	import { fetchSkills, fetchAgentSkills, createSkill, updateSkill, setAgentSkill } from '../api.js';

	let { loadError = '' } = $props();
	let showCreate = $state(false);
	let sourceMode = $state('text');
	let name = $state('');
	let description = $state('');
	let instructions = $state('');
	let markdownPath = $state('');
	let saving = $state(false);
	let expandedSkill = $state(null);

	async function saveSkill() {
		saving = true;
		try {
			let payload = { name: name.trim(), description: description.trim(), instructions: instructions.trim() };
			if (sourceMode === 'markdown') {
				const response = await fetch('/api/skills/import', {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ file_path: markdownPath.trim() })
				});
				payload = await response.json();
				if (!response.ok) throw new Error(payload.error || 'Markdown import failed');
				payload.input_schema = { _skill_source: { type: payload.source_type, path: payload.source_path } };
			}
			if (!payload.name || !payload.instructions) throw new Error('Name and instructions are required');
			await createSkill(payload);
			skills.set(await fetchSkills());
			name = ''; description = ''; instructions = ''; markdownPath = ''; showCreate = false;
			addToast('Skill created', 'success');
		} catch (error) {
			addToast(error.message, 'error');
		} finally {
			saving = false;
		}
	}

	async function toggleSkill(skill) {
		await updateSkill(skill.id, { is_active: !skill.is_active });
		skills.set(await fetchSkills());
	}

	async function toggleAssignment(agentId, skillId, enabled) {
		try {
			await setAgentSkill(agentId, skillId, enabled);
			agentSkills.set(await fetchAgentSkills());
		} catch (error) {
			addToast(error.message, 'error');
		}
	}

	function assigned(agentId, skillId) {
		return $agentSkills.some(item => item.agent_id === agentId && item.skill_id === skillId);
	}

	function getAssignedCount(skillId) {
		return $agentSkills.filter(item => item.skill_id === skillId).length;
	}
</script>

<div class="skills-studio">
	<!-- Header -->
	<div class="studio-header">
		<div class="studio-info">
			<div class="studio-count">{$skills.length} skills</div>
			{#if $skills.length > 0}
				<div class="studio-active">{$skills.filter(s => s.is_active).length} active</div>
			{/if}
		</div>
		<button class="btn btn-primary" onclick={() => showCreate = !showCreate}>
			{#if showCreate}
				<X size={14} strokeWidth={2} /> Cancel
			{:else}
				<Plus size={14} strokeWidth={2} /> Add Skill
			{/if}
		</button>
	</div>

	<!-- Create form -->
	{#if showCreate}
		<div class="create-card fade-in-up">
			<div class="create-header">
				<div class="mode-tabs">
					<button class="mode-tab {sourceMode === 'text' ? 'active' : ''}" onclick={() => sourceMode = 'text'}>
						<Pencil size={13} strokeWidth={2} /> Manual
					</button>
					<button class="mode-tab {sourceMode === 'markdown' ? 'active' : ''}" onclick={() => sourceMode = 'markdown'}>
						<FileCode2 size={13} strokeWidth={2} /> SKILL.md
					</button>
				</div>
			</div>

			{#if sourceMode === 'text'}
				<div class="create-fields">
					<div class="field-group">
						<label class="label" for="skill-name">Skill Name</label>
						<input id="skill-name" class="input" bind:value={name} placeholder="e.g. file-writer" />
					</div>
					<div class="field-group">
						<label class="label" for="skill-desc">Description</label>
						<input id="skill-desc" class="input" bind:value={description} placeholder="What this skill does and when to use it" />
					</div>
					<div class="field-group">
						<label class="label" for="skill-instructions">Instructions</label>
						<textarea id="skill-instructions" class="input" rows="5" bind:value={instructions} placeholder="Detailed skill instructions for the LLM..."></textarea>
					</div>
				</div>
			{:else}
				<div class="create-fields">
					<div class="field-group">
						<label class="label" for="skill-path">SKILL.md Path</label>
						<input id="skill-path" class="input" bind:value={markdownPath} placeholder="C:\path\to\skills\SKILL.md" />
						<div class="field-hint">Imports YAML frontmatter (name, description) and Markdown body as instructions</div>
					</div>
				</div>
			{/if}

			<button class="btn btn-primary" disabled={saving} onclick={saveSkill}>
				{#if saving}
					<Loader2 size={14} strokeWidth={2} class="spin" /> Saving...
				{:else}
					<Plus size={14} strokeWidth={2} /> Create Skill
				{/if}
			</button>
		</div>
	{/if}

	<!-- Error state -->
	{#if loadError}
		<div class="error-card">
			<div class="error-title"><AlertTriangle size={15} strokeWidth={2} /> Skill Registry Unavailable</div>
			<div class="error-msg">{loadError}</div>
			<div class="error-hint">Verify that VITE_SUPABASE_URL points to the project where the skill_registry migration was run, then reload the page.</div>
		</div>
	{:else if $skills.length === 0}
		<div class="empty-state">
					<div class="empty-state-icon"><Zap size={40} strokeWidth={1.5} /></div>
			<div class="empty-state-title">No skills yet</div>
			<div class="empty-state-desc">Skills extend your agents with specific capabilities, tool access, and behavioral policies.</div>
		</div>
	{:else}
		<div class="skills-grid">
			{#each $skills as skill (skill.id)}
				{@const assignedCount = getAssignedCount(skill.id)}
				<div class="skill-card {skill.is_active ? 'active' : 'inactive'} {expandedSkill === skill.id ? 'expanded' : ''}">
					<div class="skill-top">
						<div class="skill-icon">
							{#if skill.is_active}
								<Zap size={15} strokeWidth={2.5} />
							{:else}
								<Circle size={15} strokeWidth={2.5} />
							{/if}
						</div>
						<div class="skill-info">
							<div class="skill-name">{skill.name} <span class="skill-version">v{skill.version}</span></div>
							<div class="skill-desc">{skill.description}</div>
						</div>
						<div class="skill-controls">
							<!-- Toggle -->
							<button
								class="toggle-track {skill.is_active ? 'on' : ''}"
								onclick={() => toggleSkill(skill)}
								title="{skill.is_active ? 'Disable' : 'Enable'} skill"
							>
								<span class="toggle-thumb"></span>
							</button>
							<!-- Expand -->
							<button
								class="expand-btn"
								onclick={() => expandedSkill = expandedSkill === skill.id ? null : skill.id}
							>
								<ChevronDown size={14} strokeWidth={2} style="transform: rotate({expandedSkill === skill.id ? 180 : 0}deg); transition: transform 0.2s ease" />
							</button>
						</div>
					</div>

					{#if assignedCount > 0}
						<div class="assigned-pill">{assignedCount} agent{assignedCount !== 1 ? 's' : ''} assigned</div>
					{/if}

					{#if expandedSkill === skill.id}
						<div class="skill-assignments fade-in-up">
							<div class="assignment-title label">Assign to Agents</div>
							<div class="assignment-grid">
								{#each $agents as agent (agent.id)}
									{@const isAssigned = assigned(agent.id, skill.id)}
									<label class="assignment-item {isAssigned ? 'assigned' : ''}">
										<input
											type="checkbox"
											checked={isAssigned}
											onchange={(e) => toggleAssignment(agent.id, skill.id, e.currentTarget.checked)}
											class="assignment-check"
										/>
										<span class="assignment-role">{agent.role}</span>
										<span class="assignment-name">{agent.name}</span>
									</label>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.skills-studio {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.studio-info { display: flex; align-items: center; gap: 0.625rem; }
	.studio-count { font-size: 0.8125rem; color: var(--color-text-muted); }
	.studio-active {
		font-size: 0.75rem;
		color: var(--color-status-success-default);
		background: color-mix(in srgb, var(--color-status-success-default) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-status-success-default) 20%, transparent);
		padding: 0.15rem 0.5rem;
		border-radius: 100px;
	}

	/* Create form */
	.create-card {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-strong);
		border-radius: 12px;
		overflow: hidden;
	}
	.create-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border-default);
		background: color-mix(in srgb, var(--p-color-neutral-0) 1.5%, transparent);
	}
	.mode-tabs { display: flex; gap: 0.375rem; }
	.mode-tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.35rem 0.75rem;
		border-radius: 7px;
		font-size: 0.75rem;
		font-weight: 500;
		background: transparent;
		border: 1px solid transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.mode-tab.active {
		background: var(--color-surface-subtle);
		border-color: var(--color-border-strong);
		color: var(--color-text-primary);
	}
	.create-fields {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.create-card .btn {
		margin: 0 1rem 1rem;
	}
	.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
	.field-hint { font-size: 0.7rem; color: var(--color-text-muted); line-height: 1.4; }

	/* Error */
	.error-card {
		background: color-mix(in srgb, var(--color-status-danger-background) 60%, var(--p-color-neutral-950));
		border: 1px solid color-mix(in srgb, var(--color-status-danger-default) 30%, transparent);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.error-title { display: flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 600; color: var(--color-status-danger-default); }
	.error-msg { font-size: 0.8rem; color: var(--p-color-danger-200); font-family: var(--font-mono); }
	.error-hint { font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.5; margin-top: 0.25rem; }

	/* Skills grid */
	.skills-grid {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.skill-card {
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border-default);
		border-radius: 12px;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		transition: all 0.2s ease;
	}
	.skill-card:hover { border-color: var(--color-border-strong); }
	.skill-card.active { border-left: 3px solid var(--color-action-primary); }
	.skill-card.inactive { opacity: 0.55; }
	.skill-card.expanded { border-color: var(--color-border-inverse); }

	.skill-top {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.skill-icon { 
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0; 
		margin-top: 0.1rem; 
	}
	.skill-info { flex: 1; min-width: 0; }
	.skill-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}
	.skill-version {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		margin-left: 0.25rem;
	}
	.skill-desc {
		font-size: 0.775rem;
		color: var(--color-text-secondary);
		margin-top: 0.2rem;
		line-height: 1.4;
	}
	.skill-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}
	.expand-btn {
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: 1px solid var(--color-border-default);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}
	.expand-btn:hover { background: var(--color-surface-subtle); color: var(--color-text-primary); }

	.assigned-pill {
		font-size: 0.675rem;
		color: var(--color-action-primary-hover);
		background: color-mix(in srgb, var(--color-action-primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-action-primary) 20%, transparent);
		border-radius: 100px;
		padding: 0.15rem 0.5rem;
		align-self: flex-start;
	}

	/* Assignments */
	.skill-assignments {
		background: var(--color-surface-subtle);
		border: 1px solid var(--color-border-default);
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.assignment-title { margin-bottom: 0.125rem; }
	.assignment-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.375rem;
	}
	.assignment-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.35rem 0.5rem;
		border-radius: 7px;
		background: transparent;
		border: 1px solid var(--color-border-default);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.assignment-item:hover { background: color-mix(in srgb, var(--color-surface-elevated) 3%, transparent); }
	.assignment-item.assigned {
		background: color-mix(in srgb, var(--color-action-primary) 7%, transparent);
		border-color: color-mix(in srgb, var(--color-action-primary) 25%, transparent);
	}
	.assignment-check { cursor: pointer; accent-color: var(--color-action-primary); }
	.assignment-role {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-action-primary-hover);
	}
	.assignment-name {
		font-size: 0.72rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
