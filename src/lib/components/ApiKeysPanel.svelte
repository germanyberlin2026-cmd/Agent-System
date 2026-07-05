<script>
	import { apiKeys, agents, assignments, addToast } from '../stores.js';
import { PROVIDERS, PROVIDER_MODELS, MODEL_METADATA } from '../constants.js';
import { createApiKey, updateApiKeyModels, deleteApiKey, assignModelToAgent, removeAssignment, fetchApiKeys, fetchAssignments } from '../api.js';
import { Lightbulb, Star, Zap, Rocket } from '@lucide/svelte';
	let showAddKey = $state(false);
	let newProvider = $state('openai');
	let newLabel = $state('');
	let newApiKey = $state('');
	let customModels = $state('');
	let saving = $state(false);
	let syncingKeyId = $state(null);
	let selectedModelInfo = $state(null);

	async function handleAddKey() {
		if (!newLabel.trim() || !newApiKey.trim()) {
			addToast('Label and API key are required', 'error');
			return;
		}
		saving = true;
		try {
			const models = newProvider === 'custom'
				? customModels.split(',').map(m => m.trim()).filter(Boolean)
				: PROVIDER_MODELS[newProvider] || [];

			await createApiKey({
				provider: newProvider,
				label: newLabel.trim(),
				api_key: newApiKey.trim(),
				available_models: models
			});
			const keys = await fetchApiKeys();
			apiKeys.set(keys);
			addToast('API key added successfully', 'success');
			showAddKey = false;
			newLabel = '';
			newApiKey = '';
			customModels = '';
		} catch (err) {
			addToast(`Failed to add API key: ${err.message}`, 'error');
		} finally {
			saving = false;
		}
	}

	async function handleSyncModels(key) {
		syncingKeyId = key.id;
		try {
			const models = PROVIDER_MODELS[key.provider] || [];
			await updateApiKeyModels(key.id, models);
			apiKeys.set(await fetchApiKeys());
			addToast(`${models.length} Google models loaded locally`, 'success');
		} catch (err) {
			addToast(`Model sync failed: ${err.message}`, 'error');
		} finally {
			syncingKeyId = null;
		}
	}

	async function handleDeleteKey(id) {
		try {
			await deleteApiKey(id);
			const keys = await fetchApiKeys();
			apiKeys.set(keys);
			const a = await fetchAssignments();
			assignments.set(a);
			addToast('API key deleted', 'success');
		} catch (err) {
			addToast(`Failed to delete: ${err.message}`, 'error');
		}
	}

	async function handleAssign(agentId, apiKeyId, modelId) {
		if (!apiKeyId || !modelId) {
			const existing = getAssignment(agentId);
			if (existing) {
				await removeAssignment(agentId);
				const a = await fetchAssignments();
				assignments.set(a);
				addToast('Model assignment removed', 'success');
			}
			return;
		}
		try {
			await assignModelToAgent(agentId, apiKeyId, modelId);
			const a = await fetchAssignments();
			assignments.set(a);
			addToast('Model assigned to agent', 'success');
			// Force reactivity by creating new objects
			assignments.set([...$assignments]);
		} catch (err) {
			addToast(`Failed to assign: ${err.message}`, 'error');
		}
	}

	function getAssignment(agentId) {
		return $assignments.find(a => a.agent_id === agentId);
	}

	function getApiKey(id) {
		return $apiKeys.find(k => k.id === id);
	}

	function getModelsForProvider(provider) {
		const models = PROVIDER_MODELS[provider] || [];
		return models.map((model) => ({
			model_id: model,
			display_name: model,
			category: 'Model',
			description: MODEL_METADATA[provider]?.[model]?.description || ''
		}));
	}

	function getModelInfo(provider, modelId) {
		return MODEL_METADATA[provider]?.[modelId] || {
			name: modelId,
			intelligence: 'unknown',
			speed: 'unknown',
			cost: 'unknown',
			inputTokens: null,
			outputTokens: null,
			useCase: 'No description available',
			bestFor: [],
			description: 'Model information not available.'
		};
	}
</script>

<div class="card p-5" style="box-shadow: 0 0 32px color-mix(in srgb, var(--color-action-primary) 16%, transparent);">
	<div class="flex items-center justify-between mb-4">
		<div>
			<h3 class="text-base font-semibold">API Keys & Model Assignment</h3>
			<p class="text-xs text-secondary mt-1">Add your LLM API keys and assign models to each agent</p>
		</div>
		<button
			class="btn btn-primary"
			onclick={() => showAddKey = !showAddKey}
		>
			{showAddKey ? 'Cancel' : '+ Add API Key'}
		</button>
	</div>

	{#if showAddKey}
		<div class="card p-4 mb-4 fade-in" style="background-color: var(--color-surface-subtle)">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<label for="api-provider" class="label block mb-1.5">Provider</label>
					<select id="api-provider" class="input" bind:value={newProvider}>
						{#each Object.values(PROVIDERS) as provider}
							<option value={provider}>{provider}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="api-label" class="label block mb-1.5">Label</label>
					<input id="api-label" class="input" placeholder="e.g. OpenAI Production" bind:value={newLabel} />
				</div>
				<div class="md:col-span-2">
					<label for="api-secret" class="label block mb-1.5">API Key</label>
					<input id="api-secret" class="input" type="password" placeholder="sk-..." bind:value={newApiKey} />
				</div>
				{#if newProvider === 'custom'}
					<div class="md:col-span-2">
						<label for="api-models" class="label block mb-1.5">Available Models (comma-separated)</label>
						<input id="api-models" class="input" placeholder="model-1, model-2, model-3" bind:value={customModels} />
					</div>
				{/if}
			</div>
			<div class="flex justify-end gap-2 mt-4">
				<button class="btn btn-ghost" onclick={() => showAddKey = false}>Cancel</button>
				<button class="btn btn-primary" onclick={handleAddKey} disabled={saving}>
					{saving ? 'Saving...' : 'Save Key'}
				</button>
			</div>
		</div>
	{/if}

	<!-- API Keys List -->
	{#if $apiKeys.length === 0}
		<div class="text-center py-8 text-secondary text-sm">
			No API keys added yet. Click "Add API Key" to get started.
		</div>
	{:else}
		<div class="space-y-2 mb-6">
			{#each $apiKeys as key (key.id)}
				<div class="flex items-center justify-between p-3 rounded-lg" style="background-color: var(--color-surface-subtle)">
					<div class="flex items-center gap-3">
						<span class="badge badge-green">{key.provider}</span>
						<div>
							<div class="text-sm font-medium">{key.label}</div>
							<div class="text-xs text-muted font-mono">{key.api_key_hint}</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs text-secondary">{getModelsForProvider(key.provider).length} models</span>
						{#if key.provider === 'google'}
							<button class="btn btn-ghost" style="padding: 0.375rem 0.75rem" onclick={() => handleSyncModels(key)} disabled={syncingKeyId === key.id}>
								{syncingKeyId === key.id ? 'Syncing...' : 'Sync models'}
							</button>
						{/if}
						<button class="btn btn-danger" style="padding: 0.375rem 0.75rem" onclick={() => handleDeleteKey(key.id)}>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Agent Model Assignments -->
	{#if $agents.length > 0 && $apiKeys.length > 0}
		<div class="divider mb-4"></div>
		<h4 class="text-sm font-semibold mb-3">Assign Models to Agents</h4>
		<div class="space-y-2">
			{#each $agents as agent (agent.id)}
				{@const assignment = getAssignment(agent.id)}
				{@const assignedKey = assignment ? getApiKey(assignment.api_key_id) : null}
				{@const modelInfo = assignedKey && assignment?.model_id ? getModelInfo(assignedKey.provider, assignment.model_id) : null}
				<div class="model-assignment-row">
				<div class="flex items-center gap-3 p-3 rounded-lg" style="background-color: var(--color-surface-subtle)">
					<div class="flex items-center gap-2 min-w-0 flex-1">
						<span class="badge badge-dim">{agent.role}</span>
						<span class="text-sm font-medium truncate">{agent.name}</span>
					</div>
					<div class="flex items-center gap-2">
						<select
							class="input"
							style="width: 140px; padding: 0.375rem 0.5rem; font-size: 0.75rem"
							value={assignment?.api_key_id || ''}
							onchange={(e) => {
								const keyId = e.target.value;
								if (!keyId) {
									handleAssign(agent.id, null, null);
								} else {
									const key = getApiKey(keyId);
									const firstModel = getModelsForProvider(key?.provider)[0];
									if (firstModel) handleAssign(agent.id, keyId, firstModel.model_id);
									else addToast(`No active models found for ${key?.provider}`, 'error');
								}
							}}
						>
							<option value="">No key</option>
							{#each $apiKeys as key (key.id)}
								<option value={key.id}>{key.label}</option>
							{/each}
						</select>
						{#if assignedKey}
							{#if getModelsForProvider(assignedKey.provider).length > 0}
								<select
									class="input"
									style="width: 180px; padding: 0.375rem 0.5rem; font-size: 0.75rem"
									value={assignment?.model_id || ''}
									onchange={(e) => {
										handleAssign(agent.id, assignedKey.id, e.target.value);
										selectedModelInfo = getModelInfo(assignedKey.provider, e.target.value);
									}}
									title={selectedModelInfo?.description || 'Select a model'}
								>
									<option value="">Select model...</option>
									{#each getModelsForProvider(assignedKey.provider) as model (model.model_id)}
										<option value={model.model_id} title={model.description || model.category}>
											{model.display_name}
										</option>
									{/each}
								</select>
								{#if assignment?.model_id && selectedModelInfo}
									<div class="text-xs text-secondary" title={selectedModelInfo.description}>
										({selectedModelInfo.category}{selectedModelInfo.rpm_limit == null ? '' : ` • ${selectedModelInfo.rpm_limit} RPM`})
									</div>
								{/if}
							{:else}
								<input
									type="text"
									class="input"
									style="width: 180px; padding: 0.375rem 0.5rem; font-size: 0.75rem"
									placeholder="Enter model name"
									value={assignment?.model_id || ''}
									onblur={(e) => {
										const value = e.target.value.trim();
										if (value) handleAssign(agent.id, assignedKey.id, value);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											const value = e.target.value.trim();
											if (value) handleAssign(agent.id, assignedKey.id, value);
										}
									}}
								/>
							{/if}
						{:else}
							<div style="width: 180px" class="text-xs text-muted text-center py-2">No key assigned</div>
						{/if}
					</div>
				</div>
				{#if modelInfo}
					<div class="model-capability-strip">
						<div><span>Quality</span><strong>{modelInfo.intelligence || modelInfo.quality || 'Standard'}</strong></div>
						<div><span>Speed</span><strong>{modelInfo.speed || 'Standard'}</strong></div>
						<div><span>Cost</span><strong>{modelInfo.cost || 'Unknown'}</strong></div>
						<div><span>Context</span><strong>{modelInfo.contextWindow || modelInfo.input_token_limit || 'Unknown'}</strong></div>
						<div class="model-best-for"><span>Best for {agent.role}</span><strong>{modelInfo.bestFor?.join(' · ') || modelInfo.useCase || modelInfo.description || 'General tasks'}</strong></div>
					</div>
				{:else}
					<div class="model-capability-empty">Assign a model to see quality, speed, cost and capability guidance.</div>
				{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
