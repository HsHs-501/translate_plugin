// Central host API compatibility layer
// All host and framework imports must live exclusively in this file.

import React, {
	useState,
	useEffect,
	useMemo,
	useCallback,
	useRef,
	createContext,
	useContext,
} from 'react'

import {
	View,
	Text as RNText,
	ScrollView,
	TextInput as RNTextInput,
	TouchableOpacity,
	Pressable,
	StyleSheet,
	Modal,
	FlatList,
	ActivityIndicator,
	Dimensions,
	Platform,
} from 'react-native'

import { before, after, instead, HookPriority } from '@valenced/patcher'
import { beforeJSX, afterJSX, insteadJSX } from '@valenced/react/jsx-runtime'

import {
	lookupModule,
	lookupModules,
	getModules,
	waitForModules,
} from '@valenced/modules/finders'

import {
	withProps,
	withName,
	withDependencies,
	allOf,
	anyOf,
} from '@valenced/modules/finders/filters'

import { Design } from '@valenced/discord/design'
import {
	Stores,
	getStore,
	onFluxEventDispatched,
	onAnyFluxEventDispatched,
} from '@valenced/discord/flux'

import {
	ActionSheetActionCreators,
	AlertActionCreators,
} from '@valenced/discord/actions'

import { Logger, Constants } from '@valenced/discord/common'

import {
	Page,
	SearchInput,
	FormSwitch,
	Checkbox,
	SheetHeader,
	TableRowAssetIcon,
} from '@valenced/components'

// Re-export standard React & React Native
export {
	React,
	useState,
	useEffect,
	useMemo,
	useCallback,
	useRef,
	createContext,
	useContext,
	View,
	RNText,
	ScrollView,
	RNTextInput,
	TouchableOpacity,
	Pressable,
	StyleSheet,
	Modal,
	FlatList,
	ActivityIndicator,
	Dimensions,
	Platform,
}

// Re-export Patcher and JSX Runtime
export {
	before,
	after,
	instead,
	HookPriority,
	beforeJSX,
	afterJSX,
	insteadJSX,
}

// Re-export Module Finders and Filters
export {
	lookupModule,
	lookupModules,
	getModules,
	waitForModules,
	withProps,
	withName,
	withDependencies,
	allOf,
	anyOf,
}

// Re-export Discord & Valenced Design / Components / Flux / Actions
export {
	Design,
	Stores,
	getStore,
	onFluxEventDispatched,
	onAnyFluxEventDispatched,
	ActionSheetActionCreators,
	AlertActionCreators,
	Logger,
	Constants,
	Page,
	SearchInput,
	FormSwitch,
	Checkbox,
	SheetHeader,
	TableRowAssetIcon,
}

/**
 * Dispatch or create a local (ephemeral / bot) message visible only to the current user.
 */
export function sendLocalMessage(channelId: string, content: string) {
	try {
		// Attempt 1: Lookup standard Discord bot message creator and receiver
		const messageActions = lookupModule(withProps('receiveMessage', 'createBotMessage'))
		if (messageActions && typeof messageActions.createBotMessage === 'function' && typeof messageActions.receiveMessage === 'function') {
			const botMessage = messageActions.createBotMessage({
				channelId,
				content,
				loggingName: "Hozy's Translator",
			})
			messageActions.receiveMessage(channelId, botMessage)
			return
		}

		// Attempt 2: Lookup createBotMessage separately
		const botModule = lookupModule(withProps('createBotMessage'))
		const receiveModule = lookupModule(withProps('receiveMessage'))
		if (botModule?.createBotMessage && receiveModule?.receiveMessage) {
			const botMessage = botModule.createBotMessage({
				channelId,
				content,
				loggingName: "Hozy's Translator",
			})
			receiveModule.receiveMessage(channelId, botMessage)
			return
		}

		// Attempt 3: Direct FluxDispatcher dispatch
		const dispatcherModule = lookupModule(withProps('dispatch', 'isDispatching')) || lookupModule(withProps('flushWaitQueue'))
		if (dispatcherModule?.dispatch) {
			const randomId = Math.floor(Math.random() * 1000000000).toString()
			const timestamp = new Date().toISOString()
			dispatcherModule.dispatch({
				type: 'MESSAGE_CREATE',
				channelId,
				message: {
					id: `hozy-translate-${Date.now()}-${randomId}`,
					channel_id: channelId,
					content,
					author: {
						id: '843945264868098049',
						username: "Hozy's Translator",
						discriminator: '0000',
						avatar: 'clyde',
						bot: true,
					},
					timestamp,
					state: 'SENT',
					flags: 64, // Ephemeral / local flag
					attachments: [],
					embeds: [],
					mentions: [],
				},
			})
			return
		}
	} catch (err) {
		console.error("[Hozy's Translator] Failed to send local message:", err)
	}
}
