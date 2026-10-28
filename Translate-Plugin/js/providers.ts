import { langName } from './languages'

export type ProviderId = 'google' | 'microsoft' | 'brave'

export const PROVIDERS: Record<ProviderId, string> = {
    google: 'Google Translate',
    microsoft: 'Microsoft Translate',
    brave: 'Brave Translate',
}

export interface TranslateResult {
    text: string
    /** Detected source language code, when the provider reports one */
    detected?: string
}

const enc = encodeURIComponent

async function googleTranslate(
    text: string,
    source: string,
    target: string,
): Promise<TranslateResult> {
    const url =
        'https://translate.googleapis.com/translate_a/single?client=gtx' +
        `&sl=${enc(source)}&tl=${enc(target)}&dt=t&q=${enc(text)}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Google Translate error ${res.status}`)

    const data = await res.json()
    const translated = (data[0] as any[]).map(segment => segment[0]).join('')
    return { text: translated, detected: data[2] }
}

// Microsoft uses different codes for a few languages
const MICROSOFT_CODES: Record<string, string> = {
    'zh-CN': 'zh-Hans',
    'zh-TW': 'zh-Hant',
    iw: 'he',
    jw: 'jv',
    tl: 'fil',
    no: 'nb',
}
const msCode = (code: string) => MICROSOFT_CODES[code] ?? code

const MS_TOKEN_TTL_MS = 8 * 60 * 1000
let msToken: { value: string; at: number } | null = null

async function microsoftToken(force: boolean): Promise<string> {
    if (!force && msToken && Date.now() - msToken.at < MS_TOKEN_TTL_MS) {
        return msToken.value
    }
    const res = await fetch('https://edge.microsoft.com/translate/auth')
    if (!res.ok) throw new Error(`Microsoft auth error ${res.status}`)
    const value = (await res.text()).trim()
    msToken = { value, at: Date.now() }
    return value
}

async function microsoftTranslate(
    text: string,
    source: string,
    target: string,
): Promise<TranslateResult> {
    const url =
        'https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0' +
        `&to=${enc(msCode(target))}` +
        (source === 'auto' ? '' : `&from=${enc(msCode(source))}`)

    const call = (token: string) =>
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify([{ Text: text }]),
        })

    let res = await call(await microsoftToken(false))
    if (res.status === 401) res = await call(await microsoftToken(true))
    if (!res.ok) throw new Error(`Microsoft Translate error ${res.status}`)

    const data = await res.json()
    const translated = data?.[0]?.translations?.[0]?.text
    if (typeof translated !== 'string') {
        throw new Error('Unexpected Microsoft Translate response')
    }
    return { text: translated, detected: data[0]?.detectedLanguage?.language }
}

// Brave runs its own translation server in the Chromium translate format.
// This is an undocumented endpoint and may reject requests.
async function braveTranslate(
    text: string,
    source: string,
    target: string,
): Promise<TranslateResult> {
    const url =
        'https://translate.brave.com/translate_a/t?anno=3&client=te_lib&format=text&v=1.0' +
        `&sl=${enc(source)}&tl=${enc(target)}&tc=1&sr=1&mode=1`

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `q=${enc(text)}`,
    })
    if (!res.ok) throw new Error(`Brave Translate error ${res.status}`)

    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : data
    const translated = Array.isArray(first) ? first[0] : first
    if (typeof translated !== 'string') {
        throw new Error('Unexpected Brave Translate response')
    }
    return {
        text: translated,
        detected: Array.isArray(first) ? first[1] : undefined,
    }
}

export function translate(
    provider: ProviderId,
    text: string,
    source: string,
    target: string,
): Promise<TranslateResult> {
    switch (provider) {
        case 'microsoft':
            return microsoftTranslate(text, source, target)
        case 'brave':
            return braveTranslate(text, source, target)
        default:
            return googleTranslate(text, source, target)
    }
}

export function formatResult(
    result: TranslateResult,
    provider: ProviderId,
    source: string,
    target: string,
): string {
    const from =
        source === 'auto'
            ? result.detected
                ? `${langName(result.detected)} (auto)`
                : 'Auto-detect'
            : langName(source)
    return (
        `🌐 **Hozy's Translator** (${PROVIDERS[provider]})\n` +
        `${from} ➜ ${langName(target)}\n${result.text}`
    )
}
