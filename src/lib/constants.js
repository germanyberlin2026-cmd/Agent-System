export const AGENT_ROLES = {
	SCANNER: 'scanner', ORCHESTRATOR: 'orchestrator', CODER: 'coder', TESTER: 'tester',
	REVIEWER: 'reviewer', DOCUMENTER: 'documenter', DEBUGGER: 'debugger', ARCHITECT: 'architect'
};

export const AGENT_STATUS = { IDLE: 'idle', RUNNING: 'running', DONE: 'done', FAILED: 'failed', RETRYING: 'retrying' };
export const SCAN_STATUS = { IDLE: 'idle', SCANNING: 'scanning', DONE: 'done', FAILED: 'failed' };
export const RUN_STATUS = { PENDING: 'pending', DECOMPOSING: 'decomposing', RUNNING: 'running', VALIDATING: 'validating', COMPLETED: 'completed', FAILED: 'failed' };
export const ROUTING_STRATEGIES = { RULE_BASED: 'rule_based', CLASSIFIER: 'classifier', LLM_DECISION: 'llm_decision' };
export const VALIDATION_STRATEGIES = { SCHEMA_VALIDATION: 'schema_validation', TEST_EXECUTION: 'test_execution', ADVERSARIAL_REVIEW: 'adversarial_review' };
export const STORAGE_TYPES = { STRUCTURED_JSON: 'structured_json', KEY_VALUE_CACHE: 'key_value_cache', VECTOR_DB: 'vector_db' };
export const PROVIDERS = { OPENAI: 'openai', ANTHROPIC: 'anthropic', GOOGLE: 'google', MISTRAL: 'mistral', CUSTOM: 'custom' };

export const PROVIDER_MODELS = {
	openai: [
		'gpt-4o',
		'gpt-4o-mini',
		'gpt-4-turbo',
		'gpt-4',
		'gpt-3.5-turbo'
	],
	anthropic: [
		'claude-3-5-sonnet-20241022',
		'claude-3-5-haiku-20241022',
		'claude-3-opus-20240229',
		'claude-3-sonnet-20240229',
		'claude-3-haiku-20240307'
	],
	google: [
		'gemini-2-flash',
		'gemini-2-flash-lite',
		'gemini-2.5-flash',
		'gemini-2.5-flash-lite',
		'gemini-2.5-pro',
		'gemini-3-flash',
		'gemini-3.1-flash-lite',
		'gemini-3.1-pro',
		'gemini-3.5-flash',
		'gemini-1.5-flash',
		'gemini-1.5-pro',
		'deep-research-pro',
		'gemma-4-26b',
		'gemma-4-31b'
	],
	mistral: [
		'mistral-large-latest',
		'mistral-medium-latest',
		'mistral-small-latest',
		'codestral-latest'
	],
	custom: []
};

export const MODEL_METADATA = {
	google: {
		'gemini-2-flash': {
			name: 'Gemini 2 Flash',
			intelligence: 'high',
			speed: 'fast',
			cost: 'medium',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'General-purpose tasks, analysis, and quick responses.',
			bestFor: ['Documentation', 'Analysis', 'Quick tasks'],
			description: 'Fast and capable model for general-purpose work.'
		},
		'gemini-2-flash-lite': {
			name: 'Gemini 2 Flash Lite',
			intelligence: 'medium',
			speed: 'very-fast',
			cost: 'low',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Lightweight tasks, fast inference, and low latency.',
			bestFor: ['Simple tasks', 'Real-time processing', 'Cost-sensitive'],
			description: 'Lightweight version optimized for speed and cost.'
		},
		'gemini-2.5-flash': {
			name: 'Gemini 2.5 Flash',
			intelligence: 'high',
			speed: 'fast',
			cost: 'medium',
			inputTokens: 50,
			outputTokens: 250000,
			useCase: 'Versatile code generation and analysis.',
			bestFor: ['Code generation', 'Testing', 'Architecture design'],
			description: 'Recommended default for most tasks: fast, capable, and intelligent.'
		},
		'gemini-2.5-flash-lite': {
			name: 'Gemini 2.5 Flash Lite',
			intelligence: 'medium-high',
			speed: 'very-fast',
			cost: 'low',
			inputTokens: 100,
			outputTokens: 250000,
			useCase: 'Fast, cost-effective alternative for lighter workloads.',
			bestFor: ['Documentation', 'Simple coding', 'Lightweight analysis'],
			description: 'Good for quick tasks that need speed with solid reasoning.'
		},
		'gemini-2.5-pro': {
			name: 'Gemini 2.5 Pro',
			intelligence: 'very-high',
			speed: 'medium',
			cost: 'high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Complex reasoning, expert-level analysis, and architecture.',
			bestFor: ['Architecture', 'Security review', 'Advanced debugging'],
			description: 'Most intelligent Gemini model with strong reasoning at a higher cost.'
		},
		'gemini-3-flash': {
			name: 'Gemini 3 Flash',
			intelligence: 'very-high',
			speed: 'fast',
			cost: 'high',
			inputTokens: 50,
			outputTokens: 250000,
			useCase: 'Latest fast model with improved reasoning.',
			bestFor: ['Code review', 'Testing', 'Documentation'],
			description: 'Fast and strong for most general tasks.'
		},
		'gemini-3.1-flash-lite': {
			name: 'Gemini 3.1 Flash Lite',
			intelligence: 'medium-high',
			speed: 'very-fast',
			cost: 'low',
			inputTokens: 150,
			outputTokens: 250000,
			useCase: 'Budget-friendly fast inference.',
			bestFor: ['Quick analysis', 'Light coding', 'Cost optimization'],
			description: 'Great for simple tasks with very fast performance.'
		},
		'gemini-3.1-pro': {
			name: 'Gemini 3.1 Pro',
			intelligence: 'very-high',
			speed: 'medium',
			cost: 'high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Advanced reasoning with latest tech.',
			bestFor: ['Complex tasks', 'Expert analysis'],
			description: 'Latest high-end model for sophisticated tasks.'
		},
		'gemini-3.5-flash': {
			name: 'Gemini 3.5 Flash',
			intelligence: 'very-high',
			speed: 'fast',
			cost: 'high',
			inputTokens: 50,
			outputTokens: 250000,
			useCase: 'Best balance of speed and intelligence.',
			bestFor: ['Code generation', 'Testing', 'General tasks'],
			description: 'Latest Flash version with strong performance across tasks.'
		},
		'gemini-1.5-flash': {
			name: 'Gemini 1.5 Flash',
			intelligence: 'medium-high',
			speed: 'fast',
			cost: 'medium',
			inputTokens: 75,
			outputTokens: 300000,
			useCase: 'Large-context documents and context-heavy tasks.',
			bestFor: ['Large documents', 'Context-heavy tasks'],
			description: 'Strong previous-generation model with a large window.'
		},
		'gemini-1.5-pro': {
			name: 'Gemini 1.5 Pro',
			intelligence: 'high',
			speed: 'medium',
			cost: 'high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Advanced tasks with strong reasoning.',
			bestFor: ['Complex tasks', 'Advanced analysis'],
			description: 'High-quality previous-generation Pro model.'
		},
		'deep-research-pro': {
			name: 'Deep Research Pro',
			intelligence: 'very-high',
			speed: 'slow',
			cost: 'high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Deep research, investigation, and thorough analysis.',
			bestFor: ['Research tasks', 'Detailed analysis'],
			description: 'Specialized model for deep work and research-oriented tasks.'
		},
		'gemma-4-26b': {
			name: 'Gemma 4 26B',
			intelligence: 'medium',
			speed: 'fast',
			cost: 'low',
			inputTokens: 150,
			outputTokens: 'unlimited',
			useCase: 'Open-source and cost-sensitive workloads.',
			bestFor: ['Budget tasks', 'Open-source projects'],
			description: 'Open-source model good for cost-conscious use.'
		},
		'gemma-4-31b': {
			name: 'Gemma 4 31B',
			intelligence: 'medium-high',
			speed: 'medium',
			cost: 'low',
			inputTokens: 150,
			outputTokens: 'unlimited',
			useCase: 'Larger open-source model with better quality.',
			bestFor: ['Better open-source quality', 'Unlimited tokens'],
			description: 'More capable open-source model with strong token support.'
		}
	},
	openai: {
		'gpt-4o': {
			name: 'GPT-4O',
			intelligence: 'very-high',
			speed: 'fast',
			cost: 'high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Top-tier OpenAI model for hardest tasks.',
			bestFor: ['Complex reasoning', 'Large workloads'],
			description: 'Most capable OpenAI model, best when cost is not the primary concern.'
		},
		'gpt-4o-mini': {
			name: 'GPT-4O Mini',
			intelligence: 'high',
			speed: 'fast',
			cost: 'medium',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'General-purpose tasks with better cost efficiency.',
			bestFor: ['Most tasks', 'Cost-sensitive usage'],
			description: 'Balanced model with good performance and lower cost.'
		}
	},
	anthropic: {
		'claude-3-5-sonnet-20241022': {
			name: 'Claude 3.5 Sonnet',
			intelligence: 'very-high',
			speed: 'fast',
			cost: 'medium-high',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Powerful reasoning, code, and analysis.',
			bestFor: ['Code generation', 'Complex reasoning'],
			description: 'Strong Claude variant for high-quality reasoning and code.'
		},
		'claude-3-5-haiku-20241022': {
			name: 'Claude 3.5 Haiku',
			intelligence: 'high',
			speed: 'very-fast',
			cost: 'low',
			inputTokens: 0,
			outputTokens: 0,
			useCase: 'Fast and budget-friendly tasks.',
			bestFor: ['Quick tasks', 'Cost-sensitive use'],
			description: 'Lightweight Claude model optimized for speed.'
		}
	}
};

export function getModelInfo(provider, modelId) {
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
