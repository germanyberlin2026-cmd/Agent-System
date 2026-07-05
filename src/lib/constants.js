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

export const PROVIDERS = {
	OPENAI: 'openai',
	ANTHROPIC: 'anthropic',
	GOOGLE: 'google',
	MISTRAL: 'mistral',
	XAI: 'xai',
	GROQ: 'groq',
	COHERE: 'cohere',
	DEEPSEEK: 'deepseek',
	TOGETHER: 'together',
	PERPLEXITY: 'perplexity',
	OLLAMA: 'ollama',
	CUSTOM: 'custom'
};

export const PROVIDER_META = {
	openai:     { label: 'OpenAI',        requiresKey: true,  hasUrl: false, placeholder: 'sk-...' },
	anthropic:  { label: 'Anthropic',     requiresKey: true,  hasUrl: false, placeholder: 'sk-ant-...' },
	google:     { label: 'Google',        requiresKey: true,  hasUrl: false, placeholder: 'AIza...' },
	mistral:    { label: 'Mistral',       requiresKey: true,  hasUrl: false, placeholder: 'API key' },
	xai:        { label: 'xAI / Grok',   requiresKey: true,  hasUrl: false, placeholder: 'xai-...' },
	groq:       { label: 'Groq',         requiresKey: true,  hasUrl: false, placeholder: 'gsk_...' },
	cohere:     { label: 'Cohere',        requiresKey: true,  hasUrl: false, placeholder: 'co-...' },
	deepseek:   { label: 'DeepSeek',     requiresKey: true,  hasUrl: false, placeholder: 'sk-...' },
	together:   { label: 'Together AI',  requiresKey: true,  hasUrl: false, placeholder: 'API key' },
	perplexity: { label: 'Perplexity',   requiresKey: true,  hasUrl: false, placeholder: 'pplx-...' },
	ollama:     { label: 'Ollama (local)', requiresKey: false, hasUrl: true,  placeholder: 'http://localhost:11434' },
	custom:     { label: 'Custom',        requiresKey: true,  hasUrl: true,  placeholder: 'API key' }
};

export const PROVIDER_MODELS = {
	openai: [
		'gpt-4o',
		'gpt-4o-mini',
		'gpt-4-turbo',
		'gpt-4',
		'gpt-3.5-turbo',
		'o1',
		'o1-mini',
		'o3-mini'
	],
	anthropic: [
		'claude-opus-4-5',
		'claude-sonnet-4-5',
		'claude-3-5-sonnet-20241022',
		'claude-3-5-haiku-20241022',
		'claude-3-opus-20240229',
		'claude-3-haiku-20240307'
	],
	google: [
		'gemini-2.5-pro',
		'gemini-2.5-flash',
		'gemini-2.5-flash-lite',
		'gemini-2-flash',
		'gemini-2-flash-lite',
		'gemini-1.5-pro',
		'gemini-1.5-flash',
		'gemma-4-26b',
		'gemma-4-31b'
	],
	mistral: [
		'mistral-large-latest',
		'mistral-medium-latest',
		'mistral-small-latest',
		'codestral-latest',
		'pixtral-large-latest'
	],
	xai: [
		'grok-3',
		'grok-3-mini',
		'grok-3-fast',
		'grok-2',
		'grok-2-mini',
		'grok-beta'
	],
	groq: [
		'llama-3.3-70b-versatile',
		'llama-3.1-70b-versatile',
		'llama-3.1-8b-instant',
		'mixtral-8x7b-32768',
		'gemma2-9b-it',
		'deepseek-r1-distill-llama-70b'
	],
	cohere: [
		'command-r-plus',
		'command-r',
		'command-light',
		'command-nightly'
	],
	deepseek: [
		'deepseek-chat',
		'deepseek-coder',
		'deepseek-reasoner'
	],
	together: [
		'meta-llama/Llama-3.3-70B-Instruct-Turbo',
		'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
		'mistralai/Mixtral-8x7B-Instruct-v0.1',
		'Qwen/Qwen2.5-Coder-32B-Instruct',
		'deepseek-ai/DeepSeek-V3'
	],
	perplexity: [
		'sonar-pro',
		'sonar',
		'sonar-reasoning-pro',
		'sonar-reasoning'
	],
	ollama: [],
	custom: []
};

export const MODEL_METADATA = {
	google: {
		'gemini-2-flash': {
			name: 'Gemini 2 Flash', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 1000000,
			useCase: 'General-purpose tasks, analysis, and quick responses.',
			bestFor: ['Documentation', 'Analysis', 'Quick tasks'],
			description: 'Fast and capable model for general-purpose work.'
		},
		'gemini-2-flash-lite': {
			name: 'Gemini 2 Flash Lite', intelligence: 'medium', speed: 'very-fast', cost: 'low',
			contextWindow: 1000000,
			useCase: 'Lightweight tasks, fast inference, and low latency.',
			bestFor: ['Simple tasks', 'Real-time processing', 'Cost-sensitive'],
			description: 'Lightweight version optimized for speed and cost.'
		},
		'gemini-2.5-flash': {
			name: 'Gemini 2.5 Flash', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 1000000,
			useCase: 'Versatile code generation and analysis.',
			bestFor: ['Code generation', 'Testing', 'Architecture design'],
			description: 'Recommended default for most tasks: fast, capable, and intelligent.'
		},
		'gemini-2.5-flash-lite': {
			name: 'Gemini 2.5 Flash Lite', intelligence: 'medium-high', speed: 'very-fast', cost: 'low',
			contextWindow: 1000000,
			useCase: 'Fast, cost-effective alternative for lighter workloads.',
			bestFor: ['Documentation', 'Simple coding', 'Lightweight analysis'],
			description: 'Good for quick tasks that need speed with solid reasoning.'
		},
		'gemini-2.5-pro': {
			name: 'Gemini 2.5 Pro', intelligence: 'very-high', speed: 'medium', cost: 'high',
			contextWindow: 1000000,
			useCase: 'Complex reasoning, expert-level analysis, and architecture.',
			bestFor: ['Architecture', 'Security review', 'Advanced debugging', 'Complex reasoning'],
			description: 'Most intelligent Gemini model with strong reasoning at a higher cost.'
		},
		'gemini-1.5-flash': {
			name: 'Gemini 1.5 Flash', intelligence: 'medium-high', speed: 'fast', cost: 'medium',
			contextWindow: 1000000,
			useCase: 'Large-context documents and context-heavy tasks.',
			bestFor: ['Large documents', 'Context-heavy tasks'],
			description: 'Strong previous-generation model with a large window.'
		},
		'gemini-1.5-pro': {
			name: 'Gemini 1.5 Pro', intelligence: 'high', speed: 'medium', cost: 'high',
			contextWindow: 2000000,
			useCase: 'Advanced tasks with strong reasoning.',
			bestFor: ['Complex tasks', 'Advanced analysis'],
			description: 'High-quality previous-generation Pro model with 2M context.'
		},
		'gemma-4-26b': {
			name: 'Gemma 4 26B', intelligence: 'medium', speed: 'fast', cost: 'low',
			contextWindow: 128000,
			useCase: 'Open-source and cost-sensitive workloads.',
			bestFor: ['Budget tasks', 'Open-source projects'],
			description: 'Open-source model good for cost-conscious use.'
		},
		'gemma-4-31b': {
			name: 'Gemma 4 31B', intelligence: 'medium-high', speed: 'medium', cost: 'low',
			contextWindow: 128000,
			useCase: 'Larger open-source model with better quality.',
			bestFor: ['Better open-source quality', 'Unlimited tokens'],
			description: 'More capable open-source model.'
		}
	},
	openai: {
		'gpt-4o': {
			name: 'GPT-4o', intelligence: 'very-high', speed: 'fast', cost: 'high',
			contextWindow: 128000,
			useCase: 'Top-tier OpenAI model for hardest tasks.',
			bestFor: ['Complex reasoning', 'Code generation', 'Architecture'],
			description: 'Most capable OpenAI model, best when quality is paramount.'
		},
		'gpt-4o-mini': {
			name: 'GPT-4o Mini', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 128000,
			useCase: 'General-purpose tasks with better cost efficiency.',
			bestFor: ['General tasks', 'Testing', 'Documentation'],
			description: 'Balanced model with good performance and lower cost.'
		},
		'gpt-4-turbo': {
			name: 'GPT-4 Turbo', intelligence: 'very-high', speed: 'medium', cost: 'high',
			contextWindow: 128000,
			useCase: 'High reasoning with a large context window.',
			bestFor: ['Complex reasoning', 'Large documents'],
			description: 'Previous-generation high-capability model.'
		},
		'o1': {
			name: 'o1', intelligence: 'very-high', speed: 'slow', cost: 'very-high',
			contextWindow: 200000,
			useCase: 'Deep reasoning tasks requiring chain-of-thought.',
			bestFor: ['Advanced debugging', 'Complex reasoning', 'Expert analysis'],
			description: 'OpenAI reasoning model — best for multi-step logic and hard problems.'
		},
		'o1-mini': {
			name: 'o1 Mini', intelligence: 'high', speed: 'medium', cost: 'high',
			contextWindow: 128000,
			useCase: 'Efficient reasoning at a lower cost.',
			bestFor: ['Testing', 'Code review', 'Complex reasoning'],
			description: 'Compact reasoning model, good for structured validation tasks.'
		},
		'o3-mini': {
			name: 'o3 Mini', intelligence: 'very-high', speed: 'medium', cost: 'high',
			contextWindow: 200000,
			useCase: 'Latest generation reasoning model.',
			bestFor: ['Advanced debugging', 'Complex reasoning', 'Architecture'],
			description: 'Most capable reasoning model from OpenAI at a mid cost.'
		}
	},
	anthropic: {
		'claude-opus-4-5': {
			name: 'Claude Opus 4.5', intelligence: 'very-high', speed: 'medium', cost: 'very-high',
			contextWindow: 200000,
			useCase: 'Most capable Claude model for hardest tasks.',
			bestFor: ['Complex reasoning', 'Architecture', 'Security review'],
			description: 'Flagship Claude model for expert-level analysis and complex code.'
		},
		'claude-sonnet-4-5': {
			name: 'Claude Sonnet 4.5', intelligence: 'very-high', speed: 'fast', cost: 'medium-high',
			contextWindow: 200000,
			useCase: 'Best balance of intelligence and speed in the Claude family.',
			bestFor: ['Code generation', 'Complex reasoning', 'Documentation'],
			description: 'Recommended Anthropic model for most development tasks.'
		},
		'claude-3-5-sonnet-20241022': {
			name: 'Claude 3.5 Sonnet', intelligence: 'very-high', speed: 'fast', cost: 'medium-high',
			contextWindow: 200000,
			useCase: 'Powerful reasoning, code, and analysis.',
			bestFor: ['Code generation', 'Complex reasoning'],
			description: 'Strong Claude variant for high-quality reasoning and code.'
		},
		'claude-3-5-haiku-20241022': {
			name: 'Claude 3.5 Haiku', intelligence: 'high', speed: 'very-fast', cost: 'low',
			contextWindow: 200000,
			useCase: 'Fast and budget-friendly tasks.',
			bestFor: ['Quick tasks', 'Testing', 'Documentation'],
			description: 'Lightweight Claude model optimized for speed and cost.'
		},
		'claude-3-opus-20240229': {
			name: 'Claude 3 Opus', intelligence: 'very-high', speed: 'slow', cost: 'very-high',
			contextWindow: 200000,
			useCase: 'Expert-level analysis and complex reasoning.',
			bestFor: ['Advanced debugging', 'Security review', 'Expert analysis'],
			description: 'Previous flagship Claude — extremely capable, high cost.'
		},
		'claude-3-haiku-20240307': {
			name: 'Claude 3 Haiku', intelligence: 'medium', speed: 'very-fast', cost: 'very-low',
			contextWindow: 200000,
			useCase: 'Ultra-fast and cost-efficient for lightweight tasks.',
			bestFor: ['Simple tasks', 'Quick analysis'],
			description: 'Fastest and cheapest Claude model for light workloads.'
		}
	},
	mistral: {
		'mistral-large-latest': {
			name: 'Mistral Large', intelligence: 'very-high', speed: 'medium', cost: 'medium-high',
			contextWindow: 128000,
			useCase: 'Complex reasoning and code generation.',
			bestFor: ['Complex reasoning', 'Code generation', 'Architecture'],
			description: 'Flagship Mistral model for demanding tasks.'
		},
		'mistral-medium-latest': {
			name: 'Mistral Medium', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 32000,
			useCase: 'Balanced performance for most tasks.',
			bestFor: ['General tasks', 'Testing', 'Documentation'],
			description: 'Good mid-tier option with solid performance.'
		},
		'mistral-small-latest': {
			name: 'Mistral Small', intelligence: 'medium', speed: 'fast', cost: 'low',
			contextWindow: 32000,
			useCase: 'Fast and affordable for simple tasks.',
			bestFor: ['Simple tasks', 'Quick analysis'],
			description: 'Efficient model for routine operations.'
		},
		'codestral-latest': {
			name: 'Codestral', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 32000,
			useCase: 'Specialized for code generation and completion.',
			bestFor: ['Code generation', 'Code review', 'Testing'],
			description: 'Mistral model purpose-built for coding tasks.'
		}
	},
	xai: {
		'grok-3': {
			name: 'Grok 3', intelligence: 'very-high', speed: 'medium', cost: 'high',
			contextWindow: 131072,
			useCase: 'Advanced reasoning, code analysis, and complex tasks.',
			bestFor: ['Complex reasoning', 'Code generation', 'Architecture'],
			description: 'Most capable xAI model with strong reasoning.'
		},
		'grok-3-mini': {
			name: 'Grok 3 Mini', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 131072,
			useCase: 'Fast reasoning at lower cost.',
			bestFor: ['General tasks', 'Testing', 'Quick analysis'],
			description: 'Efficient Grok model for most everyday tasks.'
		},
		'grok-3-fast': {
			name: 'Grok 3 Fast', intelligence: 'high', speed: 'very-fast', cost: 'medium',
			contextWindow: 131072,
			useCase: 'Low-latency inference for real-time use.',
			bestFor: ['Quick tasks', 'Testing', 'Documentation'],
			description: 'Speed-optimized Grok model for latency-sensitive tasks.'
		},
		'grok-2': {
			name: 'Grok 2', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 131072,
			useCase: 'Previous-generation Grok with strong capabilities.',
			bestFor: ['Code generation', 'Analysis'],
			description: 'Solid previous-generation xAI model.'
		},
		'grok-2-mini': {
			name: 'Grok 2 Mini', intelligence: 'medium-high', speed: 'fast', cost: 'low',
			contextWindow: 131072,
			useCase: 'Budget-conscious Grok inference.',
			bestFor: ['Quick tasks', 'Simple tasks'],
			description: 'Lightweight Grok model for cost-sensitive workflows.'
		}
	},
	groq: {
		'llama-3.3-70b-versatile': {
			name: 'Llama 3.3 70B (Groq)', intelligence: 'high', speed: 'very-fast', cost: 'low',
			contextWindow: 128000,
			useCase: 'Ultra-fast open-source inference via Groq hardware.',
			bestFor: ['Code generation', 'Quick analysis', 'Testing'],
			description: 'Meta Llama 3.3 70B running at extremely low latency on Groq.'
		},
		'llama-3.1-8b-instant': {
			name: 'Llama 3.1 8B Instant (Groq)', intelligence: 'medium', speed: 'very-fast', cost: 'very-low',
			contextWindow: 128000,
			useCase: 'Fastest and cheapest option for simple tasks.',
			bestFor: ['Simple tasks', 'Documentation', 'Quick tasks'],
			description: 'Smallest Llama model — extremely fast on Groq.'
		},
		'deepseek-r1-distill-llama-70b': {
			name: 'DeepSeek R1 Distill 70B (Groq)', intelligence: 'very-high', speed: 'very-fast', cost: 'low',
			contextWindow: 128000,
			useCase: 'High-quality reasoning at low latency.',
			bestFor: ['Complex reasoning', 'Advanced debugging', 'Architecture'],
			description: 'DeepSeek reasoning model distilled and accelerated on Groq.'
		}
	},
	cohere: {
		'command-r-plus': {
			name: 'Command R+', intelligence: 'very-high', speed: 'medium', cost: 'medium-high',
			contextWindow: 128000,
			useCase: 'Best for retrieval-augmented generation and complex reasoning.',
			bestFor: ['Complex reasoning', 'Large documents', 'Context-heavy tasks'],
			description: 'Most capable Cohere model with excellent RAG performance.'
		},
		'command-r': {
			name: 'Command R', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 128000,
			useCase: 'Balanced RAG and general reasoning.',
			bestFor: ['General tasks', 'Documentation', 'Analysis'],
			description: 'Good mid-tier Cohere model for everyday tasks.'
		}
	},
	deepseek: {
		'deepseek-chat': {
			name: 'DeepSeek Chat', intelligence: 'high', speed: 'medium', cost: 'very-low',
			contextWindow: 64000,
			useCase: 'General-purpose chat and code at very low cost.',
			bestFor: ['Code generation', 'General tasks'],
			description: 'DeepSeek V3 — capable model at a fraction of the cost.'
		},
		'deepseek-coder': {
			name: 'DeepSeek Coder', intelligence: 'high', speed: 'medium', cost: 'very-low',
			contextWindow: 64000,
			useCase: 'Purpose-built for code generation and completion.',
			bestFor: ['Code generation', 'Code review', 'Testing'],
			description: 'Best DeepSeek model for pure coding tasks.'
		},
		'deepseek-reasoner': {
			name: 'DeepSeek Reasoner (R1)', intelligence: 'very-high', speed: 'slow', cost: 'low',
			contextWindow: 64000,
			useCase: 'Deep chain-of-thought reasoning for complex problems.',
			bestFor: ['Complex reasoning', 'Advanced debugging', 'Architecture'],
			description: 'DeepSeek R1 — chain-of-thought reasoning model, very capable.'
		}
	},
	perplexity: {
		'sonar-pro': {
			name: 'Sonar Pro', intelligence: 'very-high', speed: 'medium', cost: 'medium-high',
			contextWindow: 200000,
			useCase: 'Advanced reasoning with real-time search grounding.',
			bestFor: ['Research tasks', 'Large documents', 'Analysis'],
			description: 'Most capable Perplexity model with search augmentation.'
		},
		'sonar': {
			name: 'Sonar', intelligence: 'high', speed: 'fast', cost: 'medium',
			contextWindow: 128000,
			useCase: 'Fast search-grounded inference.',
			bestFor: ['Quick analysis', 'Documentation', 'Research tasks'],
			description: 'Efficient Perplexity model for search-augmented tasks.'
		},
		'sonar-reasoning-pro': {
			name: 'Sonar Reasoning Pro', intelligence: 'very-high', speed: 'slow', cost: 'high',
			contextWindow: 128000,
			useCase: 'Chain-of-thought reasoning with search.',
			bestFor: ['Complex reasoning', 'Advanced debugging'],
			description: 'Perplexity reasoning model with search grounding.'
		}
	},
	ollama: {},
	custom: {}
};

export function getModelInfo(provider, modelId) {
	return MODEL_METADATA[provider]?.[modelId] || {
		name: modelId,
		intelligence: 'unknown',
		speed: 'unknown',
		cost: 'unknown',
		contextWindow: null,
		useCase: 'No description available',
		bestFor: [],
		description: 'Model information not available.'
	};
}

export const AGENT_MODEL_PREFERENCES = {
	scanner:      { priority: 'context',   reason: 'Long context and low cost for full-project scans',   minIntelligence: 'medium', preferSpeed: true,  preferLowCost: true,  keywords: ['Large documents', 'Context-heavy tasks', 'Quick analysis'] },
	orchestrator: { priority: 'reasoning', reason: 'Strong reasoning and planning for task routing',      minIntelligence: 'high',   preferSpeed: false, preferLowCost: false, keywords: ['Complex reasoning', 'Architecture', 'Expert analysis'] },
	architect:    { priority: 'reasoning', reason: 'Deep reasoning for design and structure',             minIntelligence: 'high',   preferSpeed: false, preferLowCost: false, keywords: ['Architecture', 'Complex reasoning', 'Security review'] },
	coder:        { priority: 'quality',   reason: 'Strong code generation quality',                      minIntelligence: 'high',   preferSpeed: true,  preferLowCost: false, keywords: ['Code generation', 'Testing', 'General tasks'] },
	tester:       { priority: 'speed',     reason: 'Fast, deterministic validation',                      minIntelligence: 'medium', preferSpeed: true,  preferLowCost: true,  keywords: ['Testing', 'Quick tasks', 'Simple tasks'] },
	reviewer:     { priority: 'reasoning', reason: 'Strong reasoning for code review',                    minIntelligence: 'high',   preferSpeed: false, preferLowCost: false, keywords: ['Code review', 'Security review', 'Complex reasoning'] },
	documenter:   { priority: 'speed',     reason: 'Fast writing and documentation',                      minIntelligence: 'medium', preferSpeed: true,  preferLowCost: true,  keywords: ['Documentation', 'Quick tasks', 'Light coding'] },
	debugger:     { priority: 'reasoning', reason: 'Strong reasoning for runtime diagnosis',              minIntelligence: 'high',   preferSpeed: false, preferLowCost: false, keywords: ['Advanced debugging', 'Complex reasoning', 'Expert analysis'] }
};

const INTELLIGENCE_RANK = { 'unknown': 0, 'low': 1, 'medium': 2, 'medium-high': 3, 'high': 4, 'very-high': 5 };

export function getModelRecommendation(role, modelInfo) {
	const pref = AGENT_MODEL_PREFERENCES[role];
	if (!pref) return { level: 'neutral', reason: 'Custom role — no preference defined' };
	const intelligence = INTELLIGENCE_RANK[modelInfo.intelligence] || 0;
	const minIntelligence = INTELLIGENCE_RANK[pref.minIntelligence] || 0;
	const keywordMatch = (modelInfo.bestFor || []).some((k) =>
		pref.keywords.some((kw) => k.toLowerCase().includes(kw.toLowerCase().split(' ')[0]))
	);
	if (intelligence >= minIntelligence && keywordMatch) return { level: 'recommended', reason: pref.reason };
	if (intelligence < minIntelligence) return { level: 'warning', reason: `Model may be too lightweight for ${role}. ${pref.reason}.` };
	return { level: 'neutral', reason: 'Adequate but not optimal for this role' };
}

export const ROLE_ICONS = {
	scanner:      'search',
	orchestrator: 'network',
	architect:    'pen-tool',
	coder:        'code-2',
	tester:       'test-tube',
	reviewer:     'microscope',
	documenter:   'file-text',
	debugger:     'bug',
	custom:       'bot'
};

export const COMMON_LUCIDE_ICONS = [
	'search', 'network', 'pen-tool', 'code-2', 'test-tube', 'microscope', 'file-text', 'bug',
	'bot', 'cpu', 'terminal', 'git-branch', 'git-merge', 'git-pull-request', 'shield', 'shield-check',
	'shield-alert', 'lock', 'key-round', 'unlock', 'eye', 'eye-off', 'check-circle', 'check-circle-2',
	'alert-triangle', 'alert-circle', 'x-circle', 'x-octagon', 'zap', 'activity', 'pulse', 'gauge',
	'speed', 'rocket', 'play', 'pause', 'stop', 'skip-forward', 'rotate-ccw', 'rotate-cw',
	'refresh-cw', 'loader', 'loader-2', 'hourglass', 'clock', 'timer', 'calendar', 'history',
	'database', 'server', 'cloud', 'hard-drive', 'folder', 'folder-open', 'file', 'file-code',
	'braces', 'brackets', 'binary', 'package', 'box', 'layers', 'stack', 'grid',
	'list', 'tree', 'workflow', 'git-graph', 'share-2', 'link', 'link-2', 'unlink',
	'message-square', 'message-circle', 'mail', 'send', 'inbox', 'bell', 'bookmark', 'flag',
	'star', 'heart', 'thumbs-up', 'thumbs-down', 'smile', 'frown', 'meh', 'award',
	'trophy', 'target', 'crosshair', 'focus', 'compass', 'map', 'map-pin', 'navigation',
	'settings', 'settings-2', 'sliders', 'sliders-horizontal', 'toggle-left', 'toggle-right', 'power', 'switch-camera',
	'wrench', 'hammer', 'tools', 'screwdriver', 'saw', 'ruler', 'pen', 'pencil',
	'edit', 'edit-2', 'edit-3', 'trash', 'trash-2', 'delete', 'minus', 'minus-circle',
	'plus', 'plus-circle', 'plus-square', 'x', 'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right'
];
