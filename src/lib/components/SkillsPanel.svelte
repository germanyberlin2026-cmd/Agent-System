<script>
	import { Plus, Upload, Pencil, Copy, Trash2, ChevronDown, History, Save, X, ShieldCheck, Wrench, Users, RotateCcw } from '@lucide/svelte';
	import { skills, agentSkills, agents, addToast } from '../stores.js';
	import { fetchSkills, fetchAgentSkills, createSkill, updateSkill, deleteSkill, duplicateSkill, setAgentSkill, fetchSkillVersions, rollbackSkillVersion } from '../api.js';

	let { loadError = '' } = $props();
	let expandedId = $state(null);
	let editorOpen = $state(false);
	let editingId = $state(null);
	let saving = $state(false);
	let versions = $state([]);
	let uploadInput;
	let form = $state(emptyForm());

	function emptyForm() {
		return { name: '', category: 'general', status: 'draft', description: '', purpose: '', when_to_use: '', when_not_to_use: '', instructions: '', allowed_tools_text: '', success_criteria_text: '', examples_text: '', input_schema_text: '{}', output_schema_text: '{}', changelog: '', source_format: 'manual', change_reason: '' };
	}

	function arrayText(value) { return Array.isArray(value) ? value.join('\n') : ''; }
	function lines(value) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
	function parseJson(value, label) {
		try { return JSON.parse(value || '{}'); }
		catch { throw new Error(`${label} must be valid JSON`); }
	}
	function assignedAgents(skillId) { return $agentSkills.filter((item) => item.skill_id === skillId); }
	function isAssigned(agentId, skillId) { return $agentSkills.some((item) => item.agent_id === agentId && item.skill_id === skillId); }

	function openCreate() {
		editingId = null; form = emptyForm(); editorOpen = true; versions = [];
	}

	async function openEdit(skill) {
		editingId = skill.id;
		form = {
			name: skill.name || '', category: skill.category || 'general', status: skill.status || (skill.is_active ? 'active' : 'disabled'),
			description: skill.description || '', purpose: skill.purpose || '', when_to_use: skill.when_to_use || '', when_not_to_use: skill.when_not_to_use || '',
			instructions: skill.instructions || '', allowed_tools_text: arrayText(skill.allowed_tools), success_criteria_text: arrayText(skill.success_criteria),
			examples_text: arrayText(skill.examples), input_schema_text: JSON.stringify(skill.input_schema || {}, null, 2), output_schema_text: JSON.stringify(skill.output_schema || {}, null, 2),
			changelog: skill.changelog || '', source_format: skill.source_format || 'manual', change_reason: ''
		};
		versions = await fetchSkillVersions(skill.id).catch(() => []);
		editorOpen = true;
	}

	async function save() {
		if (!form.name.trim() || !form.instructions.trim()) return addToast('Name and policy instructions are required', 'error');
		saving = true;
		try {
			const payload = {
				name: form.name.trim(), category: form.category.trim() || 'general', status: form.status, description: form.description.trim(), purpose: form.purpose.trim(),
				when_to_use: form.when_to_use.trim(), when_not_to_use: form.when_not_to_use.trim(), instructions: form.instructions.trim(),
				allowed_tools: lines(form.allowed_tools_text), success_criteria: lines(form.success_criteria_text), examples: lines(form.examples_text),
				input_schema: parseJson(form.input_schema_text, 'Input contract'), output_schema: parseJson(form.output_schema_text, 'Output contract'),
				changelog: form.changelog.trim(), source_format: form.source_format, change_reason: form.change_reason.trim() || (editingId ? 'Skill policy updated' : 'Initial version')
			};
			if (editingId) await updateSkill(editingId, payload); else await createSkill(payload);
			skills.set(await fetchSkills()); editorOpen = false;
			addToast(editingId ? 'Skill version saved' : 'Skill created', 'success');
		} catch (error) { addToast(error.message, 'error'); }
		finally { saving = false; }
	}

	async function importFile(event) {
		const file = event.currentTarget.files?.[0]; if (!file) return;
		try {
			const text = await file.text(); openCreate(); form.source_format = file.name.split('.').pop()?.toLowerCase() || 'text'; form.name = file.name.replace(/\.[^.]+$/, '');
			if (file.name.toLowerCase().endsWith('.json')) {
				const value = JSON.parse(text); Object.assign(form, {
					name: value.name || form.name, category: value.category || 'general', description: value.description || '', purpose: value.purpose || '',
					when_to_use: value.when_to_use || '', when_not_to_use: value.when_not_to_use || '', instructions: value.instructions || value.policy || '',
					allowed_tools_text: arrayText(value.allowed_tools), success_criteria_text: arrayText(value.success_criteria), examples_text: arrayText(value.examples),
					input_schema_text: JSON.stringify(value.input_schema || {}, null, 2), output_schema_text: JSON.stringify(value.output_schema || {}, null, 2)
				});
			} else {
				const frontmatter = text.match(/^---\s*([\s\S]*?)\s*---\s*/);
				form.name = frontmatter?.[1]?.match(/^name:\s*(.+)$/m)?.[1]?.trim() || form.name;
				form.description = frontmatter?.[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
				form.instructions = frontmatter ? text.slice(frontmatter[0].length).trim() : text;
			}
			addToast('Skill loaded. Review the policy and contracts before saving.', 'success');
		} catch (error) { addToast(`Import failed: ${error.message}`, 'error'); }
	}

	async function remove(skill) {
		if (!confirm(`Delete skill “${skill.name}”? Agent assignments and version history will also be removed.`)) return;
		try { await deleteSkill(skill.id); skills.set(await fetchSkills()); agentSkills.set(await fetchAgentSkills()); addToast('Skill deleted', 'success'); }
		catch (error) { addToast(error.message, 'error'); }
	}

	async function copySkill(skill) {
		try { await duplicateSkill(skill); skills.set(await fetchSkills()); addToast('Draft copy created', 'success'); }
		catch (error) { addToast(error.message, 'error'); }
	}

	async function assign(agentId, skillId, enabled) {
		try { await setAgentSkill(agentId, skillId, enabled); agentSkills.set(await fetchAgentSkills()); addToast(enabled ? 'Skill assigned' : 'Skill unassigned', 'success'); }
		catch (error) { addToast(error.message, 'error'); }
	}

	async function rollback(versionId) {
		try { await rollbackSkillVersion(editingId, versionId); skills.set(await fetchSkills()); const skill = $skills.find((item) => item.id === editingId); await openEdit(skill); addToast('Skill restored as a new version', 'success'); }
		catch (error) { addToast(error.message, 'error'); }
	}
</script>

<input class="sr-only" bind:this={uploadInput} type="file" accept=".md,.txt,.json" onchange={importFile} aria-label="Upload skill file" />

<div class="registry-toolbar">
	<div><strong>{$skills.length} registered skills</strong><span>{$skills.filter((skill) => skill.is_active).length} active · {$agentSkills.length} agent assignments</span></div>
	<div class="button-row"><button class="btn btn-secondary" onclick={() => uploadInput?.click()}><Upload size={14} /> Upload file</button><button class="btn btn-primary" onclick={openCreate}><Plus size={14} /> Create skill</button></div>
</div>

{#if loadError}
	<div class="registry-error"><strong>Skill Registry unavailable</strong><p>{loadError}</p><small>Apply migration 20260705120000_skill_and_prompt_registry_v2.sql, then reload the PostgREST schema.</small></div>
{:else if !$skills.length}
	<div class="empty-state"><ShieldCheck size={32} /><strong>No skills registered</strong><p>Create a policy manually or import a Markdown, text, or JSON skill definition.</p></div>
{:else}
	<div class="registry-list">
		{#each $skills as skill (skill.id)}
			{@const links = assignedAgents(skill.id)}
			<article class="registry-item">
				<button class="registry-summary" onclick={() => expandedId = expandedId === skill.id ? null : skill.id}>
					<span class="registry-icon"><Wrench size={15} /></span>
					<span class="registry-main"><strong>{skill.name}</strong><small>{skill.description || skill.purpose || 'No description provided'}</small></span>
					<span class="registry-meta"><span class="tag">{skill.category || 'general'}</span><span>v{skill.version}</span><span><Users size={12} /> {links.length}</span><span class="status-badge status-{skill.status || (skill.is_active ? 'active' : 'disabled')}">{skill.status || (skill.is_active ? 'active' : 'disabled')}</span></span>
					<ChevronDown size={15} class="registry-chevron {expandedId === skill.id ? 'open' : ''}" />
				</button>
				{#if expandedId === skill.id}
					<div class="registry-detail">
						<div class="policy-grid"><section><span class="eyebrow">Purpose</span><p>{skill.purpose || skill.description || 'Not specified'}</p></section><section><span class="eyebrow">When to use</span><p>{skill.when_to_use || 'Controlled by the Orchestrator and agent assignment.'}</p></section><section><span class="eyebrow">When not to use</span><p>{skill.when_not_to_use || 'Not specified'}</p></section></div>
						<section class="policy-block"><span class="eyebrow">Execution policy</span><pre>{skill.instructions}</pre></section>
						<div class="policy-grid"><section><span class="eyebrow">Allowed tools</span><div class="tag-list">{#each skill.allowed_tools || [] as tool}<span class="tag">{tool}</span>{/each}</div></section><section><span class="eyebrow">Success criteria</span><ul>{#each skill.success_criteria || [] as criterion}<li>{criterion}</li>{/each}</ul></section><section><span class="eyebrow">Examples</span><ul>{#each skill.examples || [] as example}<li>{example}</li>{/each}</ul></section></div>
						<section class="assignment-section"><div><span class="eyebrow">Agent assignments</span><p>Only assigned active skills are injected into that agent’s execution prompt.</p></div><div class="assignment-list">{#each $agents as agent}<label class:assigned={isAssigned(agent.id, skill.id)}><input type="checkbox" checked={isAssigned(agent.id, skill.id)} onchange={(event) => assign(agent.id, skill.id, event.currentTarget.checked)} /><span><strong>{agent.name}</strong><small>{agent.role}</small></span></label>{/each}</div></section>
						<div class="registry-actions"><button class="btn btn-primary" onclick={() => openEdit(skill)}><Pencil size={13} /> Edit policy</button><button class="btn btn-secondary" onclick={() => copySkill(skill)}><Copy size={13} /> Duplicate</button><button class="btn btn-danger" onclick={() => remove(skill)}><Trash2 size={13} /> Delete</button></div>
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}

{#if editorOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit skill' : 'Create skill'}>
		<div class="modal registry-modal">
			<header class="modal-header"><div><span class="eyebrow">{editingId ? 'Versioned policy update' : 'New capability'}</span><h2>{editingId ? `Edit ${form.name}` : 'Create skill'}</h2></div><button class="icon-button" onclick={() => editorOpen = false} aria-label="Close editor"><X size={16} /></button></header>
			<div class="registry-editor">
				<section class="editor-section"><h3>Identity & routing</h3><div class="form-grid three"><label class="field"><span>Name</span><input class="input" bind:value={form.name} /></label><label class="field"><span>Category</span><input class="input" bind:value={form.category} /></label><label class="field"><span>Status</span><select class="input" bind:value={form.status}><option value="draft">Draft</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="error">Error</option></select></label></div><label class="field"><span>Description</span><input class="input" bind:value={form.description} /></label><label class="field"><span>Purpose</span><textarea class="input" rows="2" bind:value={form.purpose}></textarea></label><div class="form-grid"><label class="field"><span>When to use</span><textarea class="input" rows="3" bind:value={form.when_to_use}></textarea></label><label class="field"><span>When not to use</span><textarea class="input" rows="3" bind:value={form.when_not_to_use}></textarea></label></div></section>
				<section class="editor-section"><h3>Execution policy</h3><label class="field"><span>Instructions passed to the model</span><textarea class="input mono policy-editor" rows="10" bind:value={form.instructions}></textarea></label><div class="form-grid"><label class="field"><span>Allowed tools · one per line</span><textarea class="input mono" rows="5" bind:value={form.allowed_tools_text}></textarea></label><label class="field"><span>Success criteria · one per line</span><textarea class="input" rows="5" bind:value={form.success_criteria_text}></textarea></label></div><label class="field"><span>Examples · one per line</span><textarea class="input" rows="4" bind:value={form.examples_text}></textarea></label></section>
				<section class="editor-section"><h3>Input & output contracts</h3><div class="form-grid"><label class="field"><span>Input schema JSON</span><textarea class="input mono" rows="9" bind:value={form.input_schema_text}></textarea></label><label class="field"><span>Output schema JSON</span><textarea class="input mono" rows="9" bind:value={form.output_schema_text}></textarea></label></div><label class="field"><span>Changelog</span><textarea class="input" rows="2" bind:value={form.changelog}></textarea></label>{#if editingId}<label class="field"><span>Change reason</span><input class="input" bind:value={form.change_reason} placeholder="Why this policy changed" /></label>{/if}</section>
				{#if editingId && versions.length}<section class="editor-section"><h3><History size={15} /> Version history</h3><div class="version-list">{#each versions as version}<div><span>v{version.version}</span><small>{version.change_reason || 'No reason provided'} · {new Date(version.created_at).toLocaleString()}</small><button class="btn btn-ghost btn-sm" onclick={() => rollback(version.id)}><RotateCcw size={12} /> Restore</button></div>{/each}</div></section>{/if}
			</div>
			<footer class="modal-footer"><button class="btn btn-ghost" onclick={() => editorOpen = false}>Cancel</button><button class="btn btn-primary" disabled={saving} onclick={save}><Save size={14} /> {saving ? 'Saving…' : editingId ? 'Save new version' : 'Create skill'}</button></footer>
		</div>
	</div>
{/if}
