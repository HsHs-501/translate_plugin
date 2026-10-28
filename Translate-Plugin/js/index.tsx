import { createElement, useEffect } from 'react'
import {
    ActionSheetActionCreators,
    AlertActionCreators,
    Design,
    after,
    before,
    getModules,
    withProps,
} from './compat'
import SettingsPage, { DEFAULT_SETTINGS, type Settings } from './settings'
import { formatResult, translate } from './providers'

type SendBotMessage = (channelId: string, content: string) => void

// Finds an array of sheet rows. Supports label/onPress and message/onPressRow props.
const isRow = (el: any): boolean =>
    !!el?.props &&
    (typeof el.props.label === 'string' ||
        typeof el.props.message === 'string') &&
    (typeof el.props.onPress === 'function' ||
        typeof el.props.onPressRow === 'function')

function findRowArray(node: any, depth = 0): any[] | undefined {
    if (!node || typeof node !== 'object' || depth > 15) return
    const children = node.props?.children
    if (Array.isArray(children)) {
        if (children.some(isRow)) return children
        for (const child of children) {
            const found = findRowArray(child, depth + 1)
            if (found) return found
        }
    } else if (children) {
        return findRowArray(children, depth + 1)
    }
}

export default plugin<{ jsonStorage: Settings }>({
    jsonStorage: {
        load: true,
        default: DEFAULT_SETTINGS,
    },

    start({ cleanup, jsonStorage, logger }) {
        let sendBotMessage: SendBotMessage | undefined

        cleanup(
            getModules(
                withProps<{ sendBotMessage: SendBotMessage }>('sendBotMessage'),
                exports => {
                    sendBotMessage = exports.sendBotMessage.bind(exports)
                },
            ),
        )

        // Local message when possible, alert modal otherwise
        const notify = (channelId: string | undefined, text: string) => {
            if (channelId && sendBotMessage) {
                sendBotMessage(channelId, text)
                return
            }
            AlertActionCreators.openAlert(
                'hozy-translator',
                <Design.AlertModal
                    title="Hozy's Translator"
                    content={text}
                    actions={<Design.AlertActionButton text="Okay" />}
                />,
            )
        }

        async function translateMessage(message: any) {
            const text: string = message?.content
            if (!text?.trim()) {
                notify(message?.channel_id, '⚠️ No text to translate')
                return
            }

            const { provider, sourceLang, targetLang } = {
                ...DEFAULT_SETTINGS,
                ...(jsonStorage.cache ?? {}),
            }

            try {
                const result = await translate(
                    provider,
                    text,
                    sourceLang,
                    targetLang,
                )
                notify(
                    message.channel_id,
                    formatResult(result, provider, sourceLang, targetLang),
                )
            } catch (e) {
                logger.error('Translation failed', e)
                notify(
                    message.channel_id,
                    `⚠️ Translation failed: ${(e as Error)?.message ?? e}`,
                )
            }
        }

        // Adds a "Translate" button to the message long-press sheet
        cleanup(
            before(
                ActionSheetActionCreators,
                'openLazy',
                ([component, key, props]: any[]) => {
                    if (key !== 'MessageLongPressActionSheet') return
                    const message = props?.message
                    if (!message) return

                    component.then((instance: any) => {
                        const unpatch = after(
                            instance,
                            'default',
                            (_args: any, tree: any) => {
                                // Remove the patch when the sheet closes
                                useEffect(() => () => void unpatch(), [])

                                const rows = findRowArray(tree)
                                if (!rows) {
                                    logger.warn(
                                        'Could not find the button list in the message sheet',
                                    )
                                    return tree
                                }

                                const sample = rows.find(isRow)
                                const onPress = () => {
                                    ActionSheetActionCreators.hideActionSheet(
                                        'MessageLongPressActionSheet',
                                    )
                                    translateMessage(message)
                                }

                                const rowProps = sample.props.onPressRow
                                    ? {
                                          key: 'hozy-translate',
                                          message: 'Translate',
                                          onPressRow: onPress,
                                      }
                                    : {
                                          key: 'hozy-translate',
                                          label: 'Translate',
                                          onPress,
                                      }

                                rows.splice(
                                    1,
                                    0,
                                    createElement(sample.type, rowProps),
                                )
                                return tree
                            },
                        )
                    })
                },
            ),
        )
    },

    SettingsComponent({ api }) {
        return <SettingsPage storage={api.jsonStorage as any} />
    },
})
