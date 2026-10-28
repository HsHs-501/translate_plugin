import {
	React,
	Design,
	before,
	after,
	instead,
	beforeJSX,
	afterJSX,
	lookupModule,
	lookupModules,
	withProps,
	withName,
	ActionSheetActionCreators,
	sendLocalMessage,
	TableRowAssetIcon,
} from './compat'

import {
	TranslatorSettings,
	DEFAULT_SETTINGS,
	SettingsComponent,
} from './settings'

import { translateText, TranslationService } from './translator'
import { getLanguageName } from './languages'

/**
 * Perform translation on a message and post the result as a local message.
 */
async function handleTranslateMessage(
	message: any,
	channelId: string,
	settings: TranslatorSettings,
) {
	try {
		const textToTranslate =
			typeof message === 'string'
				? message
				: message?.content || message?.message?.content || ''

		if (!textToTranslate || textToTranslate.trim().length === 0) {
			sendLocalMessage(
				channelId,
				"⚠️ **[Hozy's Translator]**: No translatable text found in this message.",
			)
			return
		}

		const service = settings.service || 'google'
		const fromLang = settings.fromLanguage || 'auto'
		const toLang = settings.toLanguage || 'ar'

		const result = await translateText(
			textToTranslate,
			service,
			fromLang,
			toLang,
		)

		const serviceLabels: Record<TranslationService, string> = {
			google: 'Google Translate',
			microsoft: 'Microsoft Translate',
			brave: 'Brave Translate',
		}

		const fromLabel =
			result.detectedSource && result.detectedSource !== fromLang
				? `${getLanguageName(result.detectedSource)} (detected)`
				: getLanguageName(fromLang)

		const toLabel = getLanguageName(toLang)
		const serviceName = serviceLabels[result.serviceUsed] || result.serviceUsed

		const output = `🌐 **[Hozy's Translator]** (${fromLabel} ➔ ${toLabel}) [${serviceName}]:\n${result.translatedText}`

		sendLocalMessage(channelId, output)
	} catch (err: any) {
		const errorMsg = err?.message || String(err)
		sendLocalMessage(
			channelId,
			`❌ **[Hozy's Translator Error]**: ${errorMsg}`,
		)
	}
}

export default plugin<{ jsonStorage: TranslatorSettings }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_SETTINGS,
	},

	start({ cleanup, jsonStorage, logger }) {
		logger?.log("Hozy's Translator started")

		const getSettings = (): TranslatorSettings => {
			return jsonStorage.cache ?? DEFAULT_SETTINGS
		}

		/**
		 * Strategy 1: Patch ActionSheetActionCreators.openLazy
		 * When Discord opens a message long-press action sheet via ActionSheetActionCreators.openLazy
		 */
		if (ActionSheetActionCreators && typeof ActionSheetActionCreators.openLazy === 'function') {
			cleanup(
				before(
					ActionSheetActionCreators,
					'openLazy',
					(args: any[]) => {
						try {
							const [componentPromise, key, props] = args
							if (
								componentPromise &&
								typeof componentPromise.then === 'function' &&
								(key === 'MessageLongPressActionSheet' ||
									key === 'MessageActions' ||
									key === 'MessageContextMenu' ||
									props?.message)
							) {
								const interceptedPromise = componentPromise.then((module: any) => {
									const OriginalComponent =
										module?.default || (typeof module === 'function' ? module : null)

									if (!OriginalComponent) return module

									const PatchedActionSheet = (sheetProps: any) => {
										const rendered = OriginalComponent(sheetProps)
										const message =
											sheetProps?.message ||
											props?.message ||
											sheetProps?.targetMessage
										const channelId =
											sheetProps?.channel?.id ||
											props?.channel?.id ||
											message?.channel_id ||
											message?.channelId

										// If we have a message and channelId, render the Translate row inside the sheet
										if (message && channelId && rendered?.props?.children) {
											const translateRow = (
												<Design.ActionSheetRow
													key="hozy-translator-translate-action"
													label="Translate"
													icon={
														<TableRowAssetIcon name="TranslateIcon" />
													}
													onPress={() => {
														if (ActionSheetActionCreators?.hideActionSheet) {
															ActionSheetActionCreators.hideActionSheet(key)
														}
														handleTranslateMessage(
															message,
															channelId,
															getSettings(),
														)
													}}
												/>
											)

											const children = Array.isArray(rendered.props.children)
												? [...rendered.props.children, translateRow]
												: [rendered.props.children, translateRow]

											return React.cloneElement(rendered, {}, children)
										}

										return rendered
									}

									return module?.default
										? { ...module, default: PatchedActionSheet }
										: PatchedActionSheet
								})

								return [interceptedPromise, key, props]
							}
						} catch (e) {
							// Silent fallback
						}
						return args
					},
				),
			)
		}

		/**
		 * Strategy 2: Hook message action items builder / hook functions if present
		 */
		try {
			const actionModules = lookupModules(
				withProps('useMessageActions')
			)

			for (const mod of actionModules) {
				if (typeof mod?.useMessageActions === 'function') {
					cleanup(
						after(
							mod,
							'useMessageActions',
							(args: any[], ret: any) => {
								try {
									const [message, channel] = args
									if (!message || !Array.isArray(ret)) return ret

									const channelId = channel?.id || message?.channel_id || message?.channelId

									const translateItem = {
										title: 'Translate',
										label: 'Translate',
										icon: 'TranslateIcon',
										action: () => {
											handleTranslateMessage(
												message,
												channelId,
												getSettings(),
											)
										},
										onPress: () => {
											handleTranslateMessage(
												message,
												channelId,
												getSettings(),
											)
										},
									}

									return [...ret, translateItem]
								} catch {
									return ret
								}
							},
						),
					)
				}
			}
		} catch (e) {
			// Fallback
		}

		/**
		 * Strategy 3: Hook ActionSheetRow / ActionSheet components via JSX runtime
		 */
		if (Design?.ActionSheet) {
			try {
				cleanup(
					afterJSX(Design.ActionSheet, (element: any) => {
						try {
							const sheetProps = element?.props
							const message = sheetProps?.message || sheetProps?.targetMessage
							const channelId =
								sheetProps?.channel?.id ||
								message?.channel_id ||
								message?.channelId

							if (message && channelId && element?.props?.children) {
								const translateRow = (
									<Design.ActionSheetRow
										key="hozy-translator-jsx-row"
										label="Translate"
										icon={<TableRowAssetIcon name="TranslateIcon" />}
										onPress={() => {
											handleTranslateMessage(
												message,
												channelId,
												getSettings(),
											)
										}}
									/>
								)

								const children = Array.isArray(element.props.children)
									? [...element.props.children, translateRow]
									: [element.props.children, translateRow]

								return React.cloneElement(element, {}, children)
							}
						} catch {
							// Passthrough
						}
						return element
					}),
				)
			} catch (e) {
				// Passthrough
			}
		}
	},

	SettingsComponent({ api }) {
		return <SettingsComponent api={api} />
	},
})
