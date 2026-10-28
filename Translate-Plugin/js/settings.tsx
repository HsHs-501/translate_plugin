import { useState } from 'react'
import { ScrollView } from 'react-native'
import { Design } from './compat'
import { LANGUAGES, langName } from './languages'
import { PROVIDERS, type ProviderId } from './providers'

export interface Settings {
    provider: ProviderId
    sourceLang: string
    targetLang: string
}

export const DEFAULT_SETTINGS: Settings = {
    provider: 'google',
    sourceLang: 'auto',
    targetLang: 'ar',
}

type Field = keyof Settings

interface Props {
    // api.jsonStorage from the plugin API
    storage: {
        use(): Settings | undefined
        set(value: Partial<Settings>): Promise<void>
    }
}

export default function SettingsPage({ storage }: Props) {
    const { TableRow, TableRowGroup, TextInput } = Design
    const settings = { ...DEFAULT_SETTINGS, ...(storage.use() ?? {}) }

    const [picking, setPicking] = useState<Field | null>(null)
    const [query, setQuery] = useState('')

    const done = (value: Partial<Settings>) => {
        storage.set(value)
        setPicking(null)
        setQuery('')
    }

    if (picking === 'provider') {
        return (
            <ScrollView>
                <TableRowGroup title="Translation service">
                    {(Object.keys(PROVIDERS) as ProviderId[]).map(id => (
                        <TableRow
                            key={id}
                            label={
                                settings.provider === id
                                    ? `✓ ${PROVIDERS[id]}`
                                    : PROVIDERS[id]
                            }
                            onPress={() => done({ provider: id })}
                        />
                    ))}
                </TableRowGroup>
            </ScrollView>
        )
    }

    if (picking === 'sourceLang' || picking === 'targetLang') {
        const q = query.trim().toLowerCase()
        const entries = Object.entries(LANGUAGES).filter(([code, name]) =>
            `${name} ${code}`.toLowerCase().includes(q),
        )
        // "Auto-detect" only makes sense for the source language
        if (picking === 'sourceLang' && 'auto-detect'.includes(q)) {
            entries.unshift(['auto', 'Auto-detect'])
        }

        return (
            <ScrollView>
                <TableRowGroup
                    title={
                        picking === 'sourceLang'
                            ? 'Translate from'
                            : 'Translate to'
                    }
                >
                    <TextInput
                        placeholder="Search language..."
                        value={query}
                        onChange={(text: string) => setQuery(text)}
                    />
                    {entries.map(([code, name]) => (
                        <TableRow
                            key={code}
                            label={
                                settings[picking] === code ? `✓ ${name}` : name
                            }
                            subLabel={code}
                            onPress={() => done({ [picking]: code })}
                        />
                    ))}
                </TableRowGroup>
            </ScrollView>
        )
    }

    return (
        <ScrollView>
            <TableRowGroup title="Hozy's Translator">
                <TableRow
                    label="Translation service"
                    subLabel={PROVIDERS[settings.provider]}
                    arrow
                    onPress={() => setPicking('provider')}
                />
                <TableRow
                    label="Translate from"
                    subLabel={langName(settings.sourceLang)}
                    arrow
                    onPress={() => setPicking('sourceLang')}
                />
                <TableRow
                    label="Translate to"
                    subLabel={langName(settings.targetLang)}
                    arrow
                    onPress={() => setPicking('targetLang')}
                />
            </TableRowGroup>
        </ScrollView>
    )
}
