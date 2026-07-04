import { writable, derived } from 'svelte/store';

export const activeProject = writable(null);
export const activeRun = writable(null);
export const agents = writable([]);
export const apiKeys = writable([]);
export const assignments = writable([]);
export const skills = writable([]);
export const agentSkills = writable([]);
export const projects = writable([]);
export const runs = writable([]);
export const tasks = writable([]);
export const taskLogs = writable({});
export const runLogs = writable([]);
export const knowledgeCache = writable(null);
export const selectedTaskId = writable(null);
export const toasts = writable([]);

let toastId = 0;

export function addToast(message, type = 'info') {
	const id = ++toastId;
	toasts.update((t) => [...t, { id, message, type }]);
	setTimeout(() => {
		toasts.update((t) => t.filter((x) => x.id !== id));
	}, 4000);
}

export const activeTask = derived(
	[selectedTaskId, tasks],
	([$selectedTaskId, $tasks]) => $tasks.find((t) => t.id === $selectedTaskId) || null
);
