export type TranslationService = 'google' | 'microsoft' | 'brave'

export interface TranslationResult {
	translatedText: string
	detectedSource?: string
	serviceUsed: TranslationService
}

let cachedEdgeToken: string | null = null
let edgeTokenExpiry = 0

/**
 * Fetch Edge authentication token for Microsoft Translator
 */
async function getEdgeAuthToken(): Promise<string> {
	const now = Date.now()
	if (cachedEdgeToken && now < edgeTokenExpiry) {
		return cachedEdgeToken
	}

	const res = await fetch('https://edge.microsoft.com/translate/auth', {
		method: 'GET',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
		},
	})

	if (!res.ok) {
		throw new Error(`Failed to obtain Edge auth token (Status: ${res.status})`)
	}

	const token = await res.text()
	if (!token || token.trim().length === 0) {
		throw new Error('Received empty token from Edge auth endpoint')
	}

	cachedEdgeToken = token.trim()
	// Edge tokens are valid for ~10-30 minutes; cache for 9 minutes
	edgeTokenExpiry = now + 9 * 60 * 1000
	return cachedEdgeToken
}

/**
 * Translate using Google Translate (unofficial gtx client endpoint)
 */
async function translateGoogle(
	text: string,
	from: string,
	to: string,
): Promise<TranslationResult> {
	const sl = from === 'auto' ? 'auto' : from
	const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
		sl,
	)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`

	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
		},
	})

	if (!res.ok) {
		throw new Error(`Google Translate error (Status: ${res.status})`)
	}

	const data = await res.json()
	// Google single endpoint returns [[["translated", "orig", ...], ...], null, "detected_lang", ...]
	if (!Array.isArray(data) || !Array.isArray(data[0])) {
		throw new Error('Unexpected Google Translate response format')
	}

	const translatedText = data[0]
		.map((part: any) => (Array.isArray(part) && part[0] ? part[0] : ''))
		.join('')

	const detectedSource = typeof data[2] === 'string' ? data[2] : undefined

	return {
		translatedText: translatedText.trim(),
		detectedSource,
		serviceUsed: 'google',
	}
}

/**
 * Translate using Microsoft Translator (free Edge translator endpoint)
 */
async function translateMicrosoft(
	text: string,
	from: string,
	to: string,
	retry = true,
): Promise<TranslationResult> {
	const token = await getEdgeAuthToken()

	let url = `https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(
		to,
	)}`
	if (from && from !== 'auto') {
		url += `&from=${encodeURIComponent(from)}`
	}

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify([{ Text: text }]),
	})

	if (res.status === 401 && retry) {
		// Token might have expired; invalidate and retry once
		cachedEdgeToken = null
		edgeTokenExpiry = 0
		return translateMicrosoft(text, from, to, false)
	}

	if (!res.ok) {
		const errBody = await res.text().catch(() => '')
		throw new Error(
			`Microsoft Translate error (Status: ${res.status}): ${errBody}`,
		)
	}

	const data = await res.json()
	if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0].translations)) {
		throw new Error('Unexpected Microsoft Translate response format')
	}

	const translatedText = data[0].translations[0]?.text || ''
	const detectedSource = data[0].detectedLanguage?.language

	return {
		translatedText: translatedText.trim(),
		detectedSource,
		serviceUsed: 'microsoft',
	}
}

/**
 * Translate using Brave Translate (experimental endpoint)
 */
async function translateBrave(
	text: string,
	from: string,
	to: string,
): Promise<TranslationResult> {
	const sl = from === 'auto' ? 'auto' : from
	const url = `https://translate.brave.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(
		sl,
	)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`

	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
		},
	})

	if (!res.ok) {
		throw new Error(
			`Brave Translate error (Status: ${res.status}). Note: Brave Translate endpoint is experimental.`,
		)
	}

	const data = await res.json()
	let translatedText = ''
	let detectedSource: string | undefined

	if (Array.isArray(data)) {
		if (Array.isArray(data[0])) {
			translatedText = data[0]
				.map((part: any) =>
					Array.isArray(part) && part[0]
						? part[0]
						: typeof part === 'string'
							? part
							: '',
				)
				.join('')
		} else if (typeof data[0] === 'string') {
			translatedText = data.join('')
		}
		if (typeof data[2] === 'string') {
			detectedSource = data[2]
		}
	} else if (data && typeof data.text === 'string') {
		translatedText = data.text
		detectedSource = data.source_language || data.detected_language
	} else if (data && typeof data.translatedText === 'string') {
		translatedText = data.translatedText
		detectedSource = data.detectedLanguage
	}

	if (!translatedText) {
		throw new Error('Unable to parse Brave Translate response')
	}

	return {
		translatedText: translatedText.trim(),
		detectedSource,
		serviceUsed: 'brave',
	}
}

/**
 * Execute translation with the chosen service
 */
export async function translateText(
	text: string,
	service: TranslationService,
	from: string,
	to: string,
): Promise<TranslationResult> {
	const trimmed = text.trim()
	if (!trimmed) {
		return {
			translatedText: '',
			detectedSource: from,
			serviceUsed: service,
		}
	}

	switch (service) {
		case 'microsoft':
			return await translateMicrosoft(trimmed, from, to)
		case 'brave':
			return await translateBrave(trimmed, from, to)
		case 'google':
		default:
			return await translateGoogle(trimmed, from, to)
	}
}
