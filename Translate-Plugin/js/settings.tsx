import {
	React,
	useState,
	View,
	Design,
	Page,
} from './compat'
import { TranslationService } from './translator'
import {
	SOURCE_LANGUAGES,
	TARGET_LANGUAGES,
	getLanguageName,
} from './languages'
import { LanguagePickerModal } from './picker'

export interface TranslatorSettings {
	service: TranslationService
	fromLanguage: string
	toLanguage: string
}

export const DEFAULT_SETTINGS: TranslatorSettings = {
	service: 'google',
	fromLanguage: 'auto',
	toLanguage: 'ar',
}

interface SettingsComponentProps {
	api: {
		jsonStorage: {
			use(): TranslatorSettings | null
			set(settings: Partial<TranslatorSettings>): void
			get(): TranslatorSettings
		}
	}
}

export function SettingsComponent({ api }: SettingsComponentProps) {
	const currentSettings = api.jsonStorage.use() ?? DEFAULT_SETTINGS

	const [pickerType, setPickerType] = useState<'from' | 'to' | null>(null)

	const service = currentSettings.service || 'google'
	const fromLang = currentSettings.fromLanguage || 'auto'
	const toLang = currentSettings.toLanguage || 'ar'

	return (
		<Page>
			<Design.TableRowGroup title="Translation Service">
				<Design.TableRadioGroup
					value={service}
					onChange={(val: TranslationService) => {
						api.jsonStorage.set({ service: val })
					}}
				>
					<Design.TableRadioRow
						label="Google Translate"
						subLabel="Free & fast via Google Translate API"
						value="google"
						selected={service === 'google'}
						onPress={() => api.jsonStorage.set({ service: 'google' })}
					/>
					<Design.TableRadioRow
						label="Microsoft Translate"
						subLabel="Edge Browser translator service"
						value="microsoft"
						selected={service === 'microsoft'}
						onPress={() => api.jsonStorage.set({ service: 'microsoft' })}
					/>
					<Design.TableRadioRow
						label="Brave Translate"
						subLabel="Experimental Brave Translate API"
						value="brave"
						selected={service === 'brave'}
						onPress={() => api.jsonStorage.set({ service: 'brave' })}
					/>
				</Design.TableRadioGroup>
			</Design.TableRowGroup>

			<Design.TableRowGroup title="Languages">
				<Design.TableRow
					label="Translate From"
					subLabel={getLanguageName(fromLang)}
					arrow={true}
					onPress={() => setPickerType('from')}
				/>
				<Design.TableRow
					label="Translate To"
					subLabel={getLanguageName(toLang)}
					arrow={true}
					onPress={() => setPickerType('to')}
				/>
			</Design.TableRowGroup>

			{pickerType === 'from' && (
				<LanguagePickerModal
					visible={true}
					title="Select Source Language"
					languages={SOURCE_LANGUAGES}
					selectedCode={fromLang}
					onSelect={code => api.jsonStorage.set({ fromLanguage: code })}
					onClose={() => setPickerType(null)}
				/>
			)}

			{pickerType === 'to' && (
				<LanguagePickerModal
					visible={true}
					title="Select Target Language"
					languages={TARGET_LANGUAGES}
					selectedCode={toLang}
					onSelect={code => api.jsonStorage.set({ toLanguage: code })}
					onClose={() => setPickerType(null)}
				/>
			)}
		</Page>
	)
}
