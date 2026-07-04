// Content tokens — localized copy, separate from styling tokens (routes/tokens/*.css).
// Source of truth: Figma "semantic.content" collection (badge.status.text, EN/DE/RU).
export const badgeStatusText = {
	en: {
		ready: 'Ready',
		'partly-ready': 'Partly Ready',
		'at-risk': 'At Risk',
		'needs-attention': 'Needs Attention'
	},
	de: {
		ready: 'Bereit',
		'partly-ready': 'Teilweise bereit',
		'at-risk': 'Gefährdet',
		'needs-attention': 'Benötigt Aufmerksamkeit'
	},
	ru: {
		ready: 'Готово',
		'partly-ready': 'Частично готово',
		'at-risk': 'Под риском',
		'needs-attention': 'Требует внимания'
	}
};

export function getBadgeStatusText(key, locale = 'en') {
	return badgeStatusText[locale]?.[key] || badgeStatusText.en[key] || key;
}
