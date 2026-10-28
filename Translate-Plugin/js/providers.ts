import {
	React,
	useState,
	useMemo,
	View,
	RNText,
	Modal,
	FlatList,
	TouchableOpacity,
	StyleSheet,
	Design,
	SearchInput,
} from './compat'
import { LanguageItem } from './languages'

interface LanguagePickerProps {
	visible: boolean
	title: string
	languages: LanguageItem[]
	selectedCode: string
	onSelect: (code: string) => void
	onClose: () => void
}

export function LanguagePickerModal({
	visible,
	title,
	languages,
	selectedCode,
	onSelect,
	onClose,
}: LanguagePickerProps) {
	const [query, setQuery] = useState('')

	const filteredLanguages = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return languages
		return languages.filter(
			lang =>
				lang.name.toLowerCase().includes(q) ||
				lang.code.toLowerCase().includes(q),
		)
	}, [languages, query])

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent={true}
			onRequestClose={onClose}
		>
			<View style={styles.overlay}>
				<View style={styles.modalContainer}>
					<View style={styles.header}>
						<Design.Text variant="heading-lg/semibold" style={styles.headerTitle}>
							{title}
						</Design.Text>
						<TouchableOpacity onPress={onClose} style={styles.closeButton}>
							<Design.Text variant="text-md/medium" style={styles.closeButtonText}>
								Close
							</Design.Text>
						</TouchableOpacity>
					</View>

					<View style={styles.searchContainer}>
						<SearchInput
							placeholder="Search languages..."
							onChange={(v: string) => setQuery(v)}
						/>
					</View>

					<FlatList
						data={filteredLanguages}
						keyExtractor={item => item.code}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.listContent}
						renderItem={({ item }) => {
							const isSelected = item.code === selectedCode
							return (
								<TouchableOpacity
									style={[
										styles.itemRow,
										isSelected && styles.itemRowSelected,
									]}
									onPress={() => {
										onSelect(item.code)
										onClose()
									}}
								>
									<View style={styles.itemTextContainer}>
										<Design.Text
											variant="text-md/medium"
											style={[
												styles.itemTitle,
												isSelected && styles.itemTitleSelected,
											]}
										>
											{item.name}
										</Design.Text>
										<Design.Text
											variant="text-sm/normal"
											style={styles.itemSubtitle}
										>
											{item.code}
										</Design.Text>
									</View>
									{isSelected && (
										<Design.Text
											variant="text-md/bold"
											style={styles.checkmark}
										>
											✓
										</Design.Text>
									)}
								</TouchableOpacity>
							)
						}}
					/>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.65)',
		justifyContent: 'flex-end',
	},
	modalContainer: {
		backgroundColor: '#1e1f22',
		borderTopLeftRadius: 18,
		borderTopRightRadius: 18,
		maxHeight: '85%',
		minHeight: '55%',
		paddingBottom: 24,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#2b2d31',
	},
	headerTitle: {
		color: '#ffffff',
	},
	closeButton: {
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	closeButtonText: {
		color: '#5865f2',
	},
	searchContainer: {
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	listContent: {
		paddingHorizontal: 12,
		paddingBottom: 16,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderRadius: 8,
		marginVertical: 2,
		backgroundColor: '#2b2d31',
	},
	itemRowSelected: {
		backgroundColor: '#35373c',
		borderLeftWidth: 4,
		borderLeftColor: '#5865f2',
	},
	itemTextContainer: {
		flex: 1,
	},
	itemTitle: {
		color: '#dbdee1',
	},
	itemTitleSelected: {
		color: '#5865f2',
		fontWeight: 'bold',
	},
	itemSubtitle: {
		color: '#949ba4',
		marginTop: 2,
	},
	checkmark: {
		color: '#5865f2',
		marginLeft: 8,
	},
})
