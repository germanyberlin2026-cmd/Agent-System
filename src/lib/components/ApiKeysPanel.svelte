<script>
	import { apiKeys, agents, assignments, addToast } from '../stores.js';
	import { PROVIDERS, PROVIDER_META, PROVIDER_MODELS, MODEL_METADATA, getModelInfo, getModelRecommendation } from '../constants.js';
	import { createApiKey, updateApiKeyModels, deleteApiKey, assignModelToAgent, removeAssignment, fetchApiKeys, fetchAssignments, discoverOllamaModels } from '../api.js';
	import { Plus, Trash2, RefreshCw, KeyRound, Check, AlertTriangle, Minus, Search, Loader2 } from '@lucide/svelte';

	let showAddKey = $state(false);
	let newProvider = $state('openai');
	let newLabel = $state('');
	let newApiKey = $state('');
	let newBaseUrl = $state('http://localhost:11434');
	let customModels = $state('');
	let saving = $state(false);
	let syncingKeyId = $state(null);
	let discoveringOllama = $state(false);

	const providerEntries = Object.entries(PROVIDERS).map(([key, value]) => ({ key, value, ...PROVIDER_META[value] }));

	async function handleAddKey() {
		const meta = PROVIDER_META[newProvider];
		if (!newLabel.trim()) { addToast('Label is required', 'error'); return; }
		if (meta.requiresKey && !newApiKey.trim()) { addToast('API key is required for this provider', 'error'); return; }
		if (newProvider === 'ollama' && !newBaseUrl.trim()) { addToast('Base URL is required for Ollama', 'error'); return; }
		saving = true;
		try {
			let models = [];
			if (newProvider === 'ollama') {
				try {
					models = await discoverOllamaModels(newBaseUrl);
					if (!models.length) addToast('Ollama connected but no models found. Pull a model first with `ollama pull`.', 'warning');
				} catch (err) {
					addToast(`Ollama discovery failed: ${err.message}`, 'warning');
					models = [];
				}
			} else if (newProvider === 'custom') {
				models = customModels.split(',').map(m => m.trim()).filter(Boolean);
			} else {
				models = PROVIDER_MODELS[newProvider] || [];
			}
			await createApiKey({
				provider: newProvider,
				label: newLabel.trim(),
				api_key: newApiKey.trim(),
				available_models: models,
				base_url: newProvider === 'ollama' || newProvider === 'custom' ? newBaseUrl.trim() : ''
			});
			apiKeys.set(await fetchApiKeys());
			addToast(`API key added${models.length ? ` (${models.length} models)` : ''}`, 'success');
			showAddKey = false;
			newLabel = ''; newApiKey = ''; customModels = '';
		} catch (err) {
			addToast(`Failed to add API key: ${err.message}`, 'error');
		} finally { saving = false; }
	}

	async function handleDiscoverOllama(key) {
		syncingKeyId = key.id;
		try {
			const models = await discoverOllamaModels(key.base_url);
			await updateApiKeyModels(key.id, models);
			apiKeys.set(await fetchApiKeys());
			addToast(`${models.length} Ollama models discovered`, 'success');
		} catch (err) {
			addToast(`Discovery failed: ${err.message}`, 'error');
		} finally { syncingKeyId = null; }
	}

	async function handleSyncModels(key) {
		syncingKeyId = key.id;
		try {
			const models = PROVIDER_MODELS[key.provider] || [];
			await updateApiKeyModels(key.id, models);
			apiKeys.set(await fetchApiKeys());
			addToast(`${models.length} models synced`, 'success');
		} catch (err) {
			addToast(`Model sync failed: ${err.message}`, 'error');
		} finally { syncingKeyId = null; }
	}

	async function handleDeleteKey(id) {
		try {
			await deleteApiKey(id);
			apiKeys.set(await fetchApiKeys());
			assignments.set(await fetchAssignments());
			addToast('API key deleted', 'success');
		} catch (err) { addToast(`Failed to delete: ${err.message}`, 'error'); }
	}

	async function handleAssign(agentId, apiKeyId, modelId) {
		if (!apiKeyId || !modelId) {
			const existing = getAssignment(agentId);
			if (existing) {
				await removeAssignment(agentId);
				assignments.set(await fetchAssignments());
				addToast('Model assignment removed', 'success');
			}
			return;
		}
		try {
			await assignModelToAgent(agentId, apiKeyId, modelId);
			assignments.set(await fetchAssignments());
			addToast('Model assigned to agent', 'success');
		} catch (err) { addToast(`Failed to assign: ${err.message}`, 'error'); }
	}

	function getAssignment(agentId) { return $assignments.find(a => a.agent_id === agentId); }
	function getApiKey(id) { return $apiKeys.find(k => k.id === id); }
	function getModelsForProvider(provider) { return PROVIDER_MODELS[provider] || []; }
	function getModelsForKey(key) {
		if (key.available_models?.length) return key.available_models;
		return PROVIDER_MODELS[key.provider] || [];
	}
	function meterValue(level) {
		const map = { 'unknown': 25, 'low': 33, 'medium': 50, 'medium-high': 67, 'high': 84, 'very-high': 100, 'fast': 90, 'medium-fast': 70, 'medium': 50, 'slow': 30, 'very-low': 15, 'medium-low': 50, 'very-fast': 95 };
		return map[level?.toLowerCase()] || 25;
	}
	function meterClass(level) {
		const l = level?.toLowerCase();
		if (['high', 'very-high', 'fast', 'medium-fast', 'very-fast'].includes(l)) return 'success';
		if (['low', 'slow', 'very-low', 'unknown'].includes(l)) return 'warning';
		return '';
	}
</script>

<div class="keys-page">
	<!-- Provider Keys section -->
	<section class="keys-section">
		<header class="section-head">
			<div>
				<h3>Provider Keys</h3>
				<p>LLM API credentials. Keys are masked and never exposed in full. Ollama runs locally and needs no key.</p>
			</div>
			<button class="btn btn-primary" onclick={() => showAddKey = !showAddKey}>
				<Plus size={13} strokeWidth={2.2} />
				{showAddKey ? 'Cancel' : 'Add API Key'}
			</button>
		</header>

		{#if showAddKey}
			<div class="card add-key-form">
				<div class="form-grid-2">
					<label class="field">
						<span>Provider</span>
						<select class="input" bind:value={newProvider}>
							{#each providerEntries as entry}
								<option value={entry.value}>{entry.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span>Label</span>
						<input class="input" placeholder="e.g. OpenAI Production" bind:value={newLabel} />
					</label>

					{#if PROVIDER_META[newProvider]?.hasUrl}
						<label class="field col-span-2">
							<span>Base URL</span>
							<input class="input mono" bind:value={newBaseUrl} placeholder="http://localhost:11434" />
							<small class="field-hint">{newProvider === 'ollama' ? 'Ollama API endpoint. Default: http://localhost:11434' : 'OpenAI-compatible API base URL'}</small>
						</label>
					{/if}

					{#if PROVIDER_META[newProvider]?.requiresKey}
						<label class="field col-span-2">
							<span>API Key</span>
							<input class="input mono" type="password" placeholder={PROVIDER_META[newProvider]?.placeholder || 'API key'} bind:value={newApiKey} />
						</label>
					{/if}

					{#if newProvider === 'custom'}
						<label class="field col-span-2">
							<span>Available Models (comma-separated)</span>
							<input class="input" placeholder="model-1, model-2, model-3" bind:value={customModels} />
						</label>
					{/if}

					{#if newProvider === 'ollama'}
						<div class="col-span-2 ollama-hint">
							<span class="rec-badge rec-neutral">Local</span>
							<span>No API key needed. Models are discovered automatically from your Ollama instance. Make sure Ollama is running.</span>
						</div>
					{/if}
				</div>
				<div class="form-actions">
					<button class="btn btn-ghost" onclick={() => showAddKey = false}>Cancel</button>
					<button class="btn btn-primary" onclick={handleAddKey} disabled={saving}>
						{#if saving}<Loader2 size={13} class="spin" /> Saving...{:else}<Plus size={13} /> Save Key{/if}
					</button>
				</div>
			</div>
		{/if}

		{#if $apiKeys.length === 0}
			<div class="empty-state compact">
				<KeyRound size={28} />
				<strong>No API keys added</strong>
				<p>Add a provider key or connect a local Ollama instance to enable model assignment.</p>
			</div>
		{:else}
			<div class="keys-table">
				<div class="keys-table-head">
					<span>Provider</span>
					<span>Label</span>
					<span>Key / URL</span>
					<span>Models</span>
					<span>Actions</span>
				</div>
				{#each $apiKeys as key (key.id)}
					<div class="keys-table-row">
						<span class="badge badge-green">{PROVIDER_META[key.provider]?.label || key.provider}</span>
						<span class="key-label">{key.label}</span>
						<span class="key-hint mono">
							{#if key.provider === 'ollama'}{key.base_url || 'http://localhost:11434'}{:else}{key.api_key_hint || '—'}{/if}
						</span>
						<span class="key-models">{getModelsForKey(key).length} available</span>
						<span class="key-actions">
							{#if key.provider === 'ollama'}
								<button class="icon-btn" onclick={() => handleDiscoverOllama(key)} disabled={syncingKeyId === key.id} title="Discover models from Ollama">
									{#if syncingKeyId === key.id}<Loader2 size={13} class="spin" />{:else}<Search size={13} />{/if}
								</button>
							{:else if key.provider !== 'custom'}
								<button class="icon-btn" onclick={() => handleSyncModels(key)} disabled={syncingKeyId === key.id} title="Sync models">
									{#if syncingKeyId === key.id}<Loader2 size={13} class="spin" />{:else}<RefreshCw size={13} />{/if}
								</button>
							{/if}
							<button class="icon-btn danger" onclick={() => handleDeleteKey(key.id)} title="Delete key">
								<Trash2 size={13} />
							</button>
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Model Assignment Matrix -->
	{#if $agents.length > 0 && $apiKeys.length > 0}
		<section class="keys-section">
			<header class="section-head">
				<div>
					<h3>Model Assignment Matrix</h3>
					<p>Assign a provider model to each agent. Capability meters and recommendations update live.</p>
				</div>
			</header>

			<div class="matrix">
				{#each $agents as agent (agent.id)}
					{@const assignment = getAssignment(agent.id)}
					{@const assignedKey = assignment ? getApiKey(assignment.api_key_id) : null}
					{@const modelInfo = assignedKey && assignment?.model_id ? getModelInfo(assignedKey.provider, assignment.model_id) : null}
					{@const rec = modelInfo ? getModelRecommendation(agent.role, modelInfo) : null}
					<div class="matrix-row">
						<div class="matrix-agent">
							<span class="matrix-agent-icon">{agent.icon || '🤖'}</span>
							<div>
								<span class="badge badge-dim">{agent.role}</span>
								<span class="matrix-agent-name">{agent.name}</span>
							</div>
						</div>

						<div class="matrix-selects">
							<select
								class="input input-sm"
								value={assignment?.api_key_id || ''}
								onchange={(e) => {
									const keyId = e.target.value;
									if (!keyId) {
										handleAssign(agent.id, null, null);
									} else {
										const key = getApiKey(keyId);
										const firstModel = getModelsForKey(key)[0];
										if (firstModel) handleAssign(agent.id, keyId, firstModel);
										else addToast(`No models found for ${key?.provider}. ${key?.provider === 'ollama' ? 'Discover models first.' : ''}`, 'error');
									}
								}}
							>
								<option value="">No key</option>
								{#each $apiKeys as key (key.id)}
									<option value={key.id}>{key.label} · {PROVIDER_META[key.provider]?.label || key.provider}</option>
								{/each}
							</select>

							{#if assignedKey}
								<select
									class="input input-sm"
									value={assignment?.model_id || ''}
									onchange={(e) => handleAssign(agent.id, assignedKey.id, e.target.value)}
								>
									<option value="">Select model...</option>
									{#each getModelsForKey(assignedKey) as modelId}
										<option value={modelId}>{modelId}</option>
									{/each}
								</select>
							{:else}
								<div class="no-key-placeholder">No key assigned</div>
							{/if}
						</div>

						<div class="matrix-capability">
							{#if modelInfo}
								<div class="cap-grid">
									<div class="cap-meter">
										<span class="cap-meter-label">Quality</span>
										<div class="cap-meter-bar"><div class="cap-meter-fill {meterClass(modelInfo.intelligence)}" style="width: {meterValue(modelInfo.intelligence)}%"></div></div>
										<span class="cap-meter-value">{modelInfo.intelligence || 'Standard'}</span>
									</div>
									<div class="cap-meter">
										<span class="cap-meter-label">Speed</span>
										<div class="cap-meter-bar"><div class="cap-meter-fill {meterClass(modelInfo.speed)}" style="width: {meterValue(modelInfo.speed)}%"></div></div>
										<span class="cap-meter-value">{modelInfo.speed || 'Standard'}</span>
									</div>
									<div class="cap-meter">
										<span class="cap-meter-label">Cost</span>
										<div class="cap-meter-bar"><div class="cap-meter-fill {meterClass(modelInfo.cost)}" style="width: {meterValue(modelInfo.cost)}%"></div></div>
										<span class="cap-meter-value">{modelInfo.cost || 'Unknown'}</span>
									</div>
									<div class="cap-meter">
										<span class="cap-meter-label">Context</span>
										<div class="cap-meter-bar"><div class="cap-meter-fill" style="width: {modelInfo.contextWindow ? Math.min(100, (modelInfo.contextWindow / 200000) * 100) : 25}%"></div></div>
										<span class="cap-meter-value">{modelInfo.contextWindow ? (modelInfo.contextWindow >= 1000000 ? '1M' : `${Math.round(modelInfo.contextWindow / 1000)}K`) : 'Unknown'}</span>
									</div>
								</div>
								{#if modelInfo.bestFor?.length}
									<div class="best-for">
										<span class="cap-meter-label">Best for</span>
										<span class="best-for-tags">{#each modelInfo.bestFor.slice(0, 3) as tag}<span class="tag">{tag}</span>{/each}</span>
									</div>
								{/if}
							{:else}
								<div class="cap-empty">Assign a model to see quality, speed, cost and capability guidance.</div>
							{/if}
						</div>

						<div class="matrix-rec">
							{#if rec}
								{#if rec.level === 'recommended'}
									<span class="rec-badge rec-recommended"><Check size={11} /> Recommended</span>
								{:else if rec.level === 'warning'}
									<span class="rec-badge rec-warning"><AlertTriangle size={11} /> Not optimal</span>
								{:else}
									<span class="rec-badge rec-neutral"><Minus size={11} /> Adequate</span>
								{/if}
								<span class="rec-reason">{rec.reason}</span>
							{:else}
								<span class="rec-badge rec-neutral">No model</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.keys-page { display: flex; flex-direction: column; gap: 1.75rem; }
	.keys-section { display: flex; flex-direction: column; gap: 0.875rem; }
	.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
	.section-head h3 { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); margin: 0 0 0.25rem; letter-spacing: -0.02em; }
	.section-head p { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }

	.add-key-form { padding: 1.125rem; background: var(--color-surface-subtle); border: 1px solid var(--color-border-default); border-radius: 10px; }
	.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	.col-span-2 { grid-column: 1 / -1; }
	.field { display: flex; flex-direction: column; gap: 0.375rem; }
	.field span { font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); }
	.field-hint { font-size: 0.72rem; color: var(--color-text-muted); }
	.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.875rem; }

	.ollama-hint { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.75rem; background: var(--color-background-subtle); border-radius: 8px; font-size: 0.75rem; color: var(--color-text-muted); }

	.keys-table { display: flex; flex-direction: column; border: 1px solid var(--color-border-default); border-radius: 10px; overflow: hidden; }
	.keys-table-head { display: grid; grid-template-columns: 130px 1fr 180px 100px 80px; gap: 0.75rem; padding: 0.625rem 0.875rem; background: var(--color-background-subtle); border-bottom: 1px solid var(--color-border-default); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
	.keys-table-row { display: grid; grid-template-columns: 130px 1fr 180px 100px 80px; gap: 0.75rem; padding: 0.75rem 0.875rem; align-items: center; border-bottom: 1px solid var(--color-border-subtle); }
	.keys-table-row:last-child { border-bottom: none; }
	.key-label { font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); }
	.key-hint { font-size: 0.75rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.key-models { font-size: 0.75rem; color: var(--color-text-secondary); }
	.key-actions { display: flex; gap: 0.25rem; }

	.icon-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--color-border-default); background: transparent; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
	.icon-btn:hover { background: var(--color-surface-subtle); color: var(--color-text-primary); border-color: var(--color-border-strong); }
	.icon-btn.danger:hover { background: color-mix(in srgb, var(--color-status-danger-default) 10%, transparent); color: var(--color-status-danger-default); border-color: color-mix(in srgb, var(--color-status-danger-default) 30%, transparent); }

	.matrix { display: flex; flex-direction: column; border: 1px solid var(--color-border-default); border-radius: 10px; overflow: hidden; }
	.matrix-row { display: grid; grid-template-columns: 180px 220px 1fr 160px; gap: 1rem; padding: 0.875rem 1rem; align-items: flex-start; border-bottom: 1px solid var(--color-border-subtle); }
	.matrix-row:last-child { border-bottom: none; }
	.matrix-agent { display: flex; align-items: center; gap: 0.5rem; }
	.matrix-agent-icon { font-size: 1.25rem; line-height: 1; }
	.matrix-agent > div { display: flex; flex-direction: column; gap: 0.25rem; }
	.matrix-agent-name { font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); }
	.matrix-selects { display: flex; flex-direction: column; gap: 0.375rem; }
	.input-sm { padding: 0.375rem 0.5rem; font-size: 0.75rem; }
	.no-key-placeholder { font-size: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 0.5rem; }
	.matrix-capability { display: flex; flex-direction: column; gap: 0.5rem; }
	.cap-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.625rem; }
	.best-for { display: flex; align-items: center; gap: 0.5rem; }
	.best-for-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
	.cap-empty { font-size: 0.75rem; color: var(--color-text-muted); padding: 0.5rem 0; }
	.matrix-rec { display: flex; flex-direction: column; gap: 0.25rem; }
	.rec-reason { font-size: 0.6875rem; color: var(--color-text-muted); line-height: 1.4; }

	@media (max-width: 1100px) {
		.matrix-row { grid-template-columns: 1fr; gap: 0.625rem; }
		.keys-table-head, .keys-table-row { grid-template-columns: 1fr; gap: 0.375rem; }
	}
</style>
