import React, { useState, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Clipboard,
    Alert,
} from "react-native";
import { plugin, patcher } from "@valenced/api";
import { findByProps } from "@valenced/discord/metro";
import {
    TableRowGroup,
    TableRow,
    TableSwitchRow,
} from "@valenced/discord/design";

export type TranslationEngine = "google" | "microsoft" | "brave";

export interface Settings {
    engine: TranslationEngine;
    sourceLang: string;
    targetLang: string;
    autoCopy: boolean;
    braveApiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
    engine: "google",
    sourceLang: "auto",
    targetLang: "ar",
    autoCopy: false,
    braveApiKey: "",
};

export const ENGINES: { id: TranslationEngine; name: string; description: string }[] = [
    {
        id: "google",
        name: "Google Translate",
        description: "Fast, accurate, and supports over 100 languages.",
    },
    {
        id: "microsoft",
        name: "Microsoft Translator",
        description: "Bing Translator engine with robust multi-language detection.",
    },
    {
        id: "brave",
        name: "Brave Translator",
        description: "Privacy-focused translator powered by Brave & Lingvanex.",
    },
];

export const LANGUAGES: Record<string, string> = {
    af: "Afrikaans",
    sq: "Albanian",
    am: "Amharic",
    ar: "Arabic",
    hy: "Armenian",
    az: "Azerbaijani",
    eu: "Basque",
    be: "Belarusian",
    bn: "Bengali",
    bs: "Bosnian",
    bg: "Bulgarian",
    ca: "Catalan",
    ceb: "Cebuano",
    ny: "Chichewa",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    co: "Corsican",
    hr: "Croatian",
    cs: "Czech",
    da: "Danish",
    nl: "Dutch",
    en: "English",
    eo: "Esperanto",
    et: "Estonian",
    tl: "Filipino",
    fi: "Finnish",
    fr: "French",
    fy: "Frisian",
    gl: "Galician",
    ka: "Georgian",
    de: "German",
    el: "Greek",
    gu: "Gujarati",
    ht: "Haitian Creole",
    ha: "Hausa",
    haw: "Hawaiian",
    iw: "Hebrew",
    hi: "Hindi",
    hmn: "Hmong",
    hu: "Hungarian",
    is: "Icelandic",
    ig: "Igbo",
    id: "Indonesian",
    ga: "Irish",
    it: "Italian",
    ja: "Japanese",
    jw: "Javanese",
    kn: "Kannada",
    kk: "Kazakh",
    km: "Khmer",
    rw: "Kinyarwanda",
    ko: "Korean",
    ku: "Kurdish (Kurmanji)",
    ky: "Kyrgyz",
    lo: "Lao",
    la: "Latin",
    lv: "Latvian",
    lt: "Lithuanian",
    lb: "Luxembourgish",
    mk: "Macedonian",
    mg: "Malagasy",
    ms: "Malay",
    ml: "Malayalam",
    mt: "Maltese",
    mi: "Maori",
    mr: "Marathi",
    mn: "Mongolian",
    my: "Myanmar (Burmese)",
    ne: "Nepali",
    no: "Norwegian",
    or: "Odia",
    ps: "Pashto",
    fa: "Persian",
    pl: "Polish",
    pt: "Portuguese",
    pa: "Punjabi",
    ro: "Romanian",
    ru: "Russian",
    sm: "Samoan",
    gd: "Scots Gaelic",
    sr: "Serbian",
    st: "Sesotho",
    sn: "Shona",
    sd: "Sindhi",
    si: "Sinhala",
    sk: "Slovak",
    sl: "Slovenian",
    so: "Somali",
    es: "Spanish",
    su: "Sundanese",
    sw: "Swahili",
    sv: "Swedish",
    tg: "Tajik",
    ta: "Tamil",
    tt: "Tatar",
    te: "Telugu",
    th: "Thai",
    tr: "Turkish",
    tk: "Turkmen",
    uk: "Ukrainian",
    ur: "Urdu",
    ug: "Uyghur",
    uz: "Uzbek",
    vi: "Vietnamese",
    cy: "Welsh",
    xh: "Xhosa",
    yi: "Yiddish",
    yo: "Yoruba",
    zu: "Zulu",
};

export const getLanguageName = (code: string): string => {
    if (code === "auto") return "Auto-detect";
    return LANGUAGES[code] || code;
};

// -------------------------------------------------------------
// Translation Engines Implementation
// -------------------------------------------------------------

// 1. Google Translate
async function googleTranslate(
    text: string,
    source: string,
    target: string
): Promise<{ text: string; detected: string }> {
    const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx" +
        "&sl=" +
        encodeURIComponent(source) +
        "&tl=" +
        encodeURIComponent(target) +
        "&dt=t&q=" +
        encodeURIComponent(text);

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Google Translate error ${res.status}`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data[0])) {
        throw new Error("Invalid response received from Google Translate");
    }

    const translated = data[0].map((seg: any) => seg[0]).join("");
    const detected = data[2] || source;

    return { text: translated, detected };
}

// 2. Microsoft / Bing Translator
let cachedBingToken: { ig: string; key: string; token: string } | null = null;
let bingTokenExpiry = 0;

async function getBingToken(): Promise<{ ig: string; key: string; token: string }> {
    const now = Date.now();
    if (cachedBingToken && now < bingTokenExpiry) {
        return cachedBingToken;
    }

    const res = await fetch("https://www.bing.com/translator", {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to access Bing Translator page: ${res.status}`);
    }

    const html = await res.text();
    const igMatch = html.match(/IG:"([^"]+)"/);
    const paramsMatch = html.match(
        /params_AbusePreventionHelper\s*=\s*\[([0-9]+),"([^"]+)"/
    );

    if (!igMatch || !paramsMatch) {
        throw new Error("Could not extract Microsoft Translator authentication parameters");
    }

    cachedBingToken = {
        ig: igMatch[1],
        key: paramsMatch[1],
        token: paramsMatch[2],
    };
    bingTokenExpiry = now + 10 * 60 * 1000; // Cache for 10 minutes
    return cachedBingToken;
}

async function microsoftTranslate(
    text: string,
    source: string,
    target: string
): Promise<{ text: string; detected: string }> {
    const { ig, key, token } = await getBingToken();
    const fromLang = source === "auto" || !source ? "auto-detect" : source;

    const body = new URLSearchParams({
        fromLang,
        text,
        to: target,
        token,
        key,
    });

    const res = await fetch(
        `https://www.bing.com/ttranslatev3?isVertical=1&&IG=${ig}&IID=translator.5028`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                Referer: "https://www.bing.com/translator",
            },
            body: body.toString(),
        }
    );

    if (!res.ok) {
        throw new Error(`Microsoft Translator API error: ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data[0] || !data[0].translations || !data[0].translations[0]) {
        throw new Error("Invalid response format received from Microsoft Translator");
    }

    const translated = data[0].translations[0].text;
    const detected = data[0].detectedLanguage ? data[0].detectedLanguage.language : source;

    return { text: translated, detected };
}

// 3. Brave Translator (with resilient fallback)
async function braveTranslate(
    text: string,
    source: string,
    target: string,
    apiKey?: string
): Promise<{ text: string; detected: string }> {
    // Attempt Brave translate endpoint
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Brave/122.0.0.0",
        };
        if (apiKey && apiKey.trim()) {
            headers["Authorization"] = `Bearer ${apiKey.trim()}`;
            headers["X-Brave-Key"] = apiKey.trim();
        }

        const res = await fetch("https://translate.brave.com/api/v1/translate", {
            method: "POST",
            headers,
            body: JSON.stringify({
                text: [text],
                source_lang: source === "auto" ? "auto" : source,
                target_lang: target,
            }),
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.translations && data.translations[0]?.text) {
                return {
                    text: data.translations[0].text,
                    detected: data.detected_lang || source,
                };
            }
        }
    } catch {}

    // Fallback: MyMemory (privacy-friendly alternative)
    try {
        const pair = `${source === "auto" ? "Autodetect" : source}|${target}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            text
        )}&langpair=${encodeURIComponent(pair)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.responseData?.translatedText) {
                return {
                    text: data.responseData.translatedText,
                    detected: data.responseData.detectedLanguage || source,
                };
            }
        }
    } catch {}

    // Final fallback to Microsoft engine
    return microsoftTranslate(text, source, target);
}

// Universal translate dispatcher
async function executeTranslation(
    text: string,
    source: string,
    target: string,
    engine: TranslationEngine,
    braveApiKey?: string
): Promise<{ text: string; detected: string; engineName: string }> {
    switch (engine) {
        case "microsoft": {
            const res = await microsoftTranslate(text, source, target);
            return { ...res, engineName: "Microsoft" };
        }
        case "brave": {
            const res = await braveTranslate(text, source, target, braveApiKey);
            return { ...res, engineName: "Brave" };
        }
        case "google":
        default: {
            const res = await googleTranslate(text, source, target);
            return { ...res, engineName: "Google" };
        }
    }
}

function formatResult(
    text: string,
    detected: string,
    source: string,
    target: string,
    engineName: string
): string {
    const fromLabel =
        source === "auto" ? `${getLanguageName(detected)} (auto)` : getLanguageName(source);
    const toLabel = getLanguageName(target);
    return `🌐 **Translate (${engineName})** • ${fromLabel} ➔ ${toLabel}\n${text}`;
}

// -------------------------------------------------------------
// UI / Action Sheet Helpers
// -------------------------------------------------------------

const isRow = (el: any): boolean =>
    !!(
        el &&
        el.props &&
        (typeof el.props.label === "string" || typeof el.props.message === "string") &&
        (typeof el.props.onPress === "function" || typeof el.props.onPressRow === "function")
    );

function findRowArray(node: any, depth = 0): any[] | undefined {
    if (!node || typeof node !== "object" || depth > 15) return undefined;
    const children = node.props && node.props.children;
    if (Array.isArray(children)) {
        if (children.some(isRow)) return children;
        for (const child of children) {
            const found = findRowArray(child, depth + 1);
            if (found) return found;
        }
    } else if (children && typeof children === "object") {
        return findRowArray(children, depth + 1);
    }
    return undefined;
}

// Resolves Discord's native translate/locale icon asset ID
function resolveTranslateIconAsset(): number | undefined {
    try {
        const Assets = findByProps("getAssetIDByName");
        if (!Assets || typeof Assets.getAssetIDByName !== "function") return undefined;

        const candidateNames = [
            "ic_message_actions_translate",
            "ic_translate_24px",
            "TranslateIcon",
            "ic_locale_24px",
            "ic_language_24px",
            "LanguageIcon",
            "ic_globe_24px",
            "GlobeIcon",
        ];

        for (const name of candidateNames) {
            try {
                const id = Assets.getAssetIDByName(name);
                if (id !== undefined && id !== null) return id;
            } catch {}
        }
    } catch {}
    return undefined;
}

function safePatchBefore(
    target: any,
    method: string,
    callback: (...args: any[]) => void,
    logger?: any
): () => void {
    if (!target || !target[method]) return () => {};

    if (typeof patcher !== "undefined") {
        if (typeof patcher.before === "function") {
            try {
                return patcher.before(method, target, callback);
            } catch {
                try {
                    return patcher.before(target, method, callback);
                } catch (err) {
                    logger?.error?.("[Hozy's Translator] Failed to invoke patcher.before", err);
                }
            }
        }
    }

    const original = target[method];
    target[method] = function (...args: any[]) {
        try {
            callback.call(this, args);
        } catch (err) {
            logger?.error?.("[Hozy's Translator] Error in before callback", err);
        }
        return original.apply(this, args);
    };

    return () => {
        target[method] = original;
    };
}

function safePatchAfter(
    target: any,
    method: string,
    callback: (args: any[], result: any) => any,
    logger?: any
): () => void {
    if (!target || !target[method]) return () => {};

    if (typeof patcher !== "undefined") {
        if (typeof patcher.after === "function") {
            try {
                return patcher.after(method, target, callback);
            } catch {
                try {
                    return patcher.after(target, method, callback);
                } catch (err) {
                    logger?.error?.("[Hozy's Translator] Failed to invoke patcher.after", err);
                }
            }
        }
    }

    const original = target[method];
    target[method] = function (...args: any[]) {
        const result = original.apply(this, args);
        try {
            return callback.call(this, args, result) ?? result;
        } catch (err) {
            logger?.error?.("[Hozy's Translator] Error in after callback", err);
            return result;
        }
    };

    return () => {
        target[method] = original;
    };
}

// -------------------------------------------------------------
// Valenced Plugin Entry Point
// -------------------------------------------------------------

export default plugin<Settings>({
    start({ cleanup, jsonStorage, logger }) {
        logger?.info?.("[Hozy's Translator] Initializing Valenced Translator...");

        const MessageUtil = findByProps("sendBotMessage");
        const LazyActionSheet =
            findByProps("openLazy", "hideActionSheet") || findByProps("openLazy");
        const ToastUtil = findByProps("showToast");
        const ToastIcons = findByProps("getAssetIDByName");
        const ClipboardUtil = findByProps("setString", "getString");

        const showNotice = (content: string, isError = false) => {
            try {
                if (ToastUtil && typeof ToastUtil.showToast === "function") {
                    const icon = ToastIcons?.getAssetIDByName
                        ? ToastIcons.getAssetIDByName(isError ? "Small" : "Checkmark")
                        : undefined;
                    ToastUtil.showToast(content, icon);
                    return;
                }
            } catch {}
            Alert.alert("Hozy's Translator", content);
        };

        const copyText = (content: string) => {
            try {
                if (ClipboardUtil && typeof ClipboardUtil.setString === "function") {
                    ClipboardUtil.setString(content);
                } else if (Clipboard && typeof Clipboard.setString === "function") {
                    Clipboard.setString(content);
                }
            } catch {}
        };

        const getSetting = <K extends keyof Settings>(key: K): Settings[K] => {
            try {
                const val =
                    typeof jsonStorage.get === "function"
                        ? jsonStorage.get(key)
                        : (jsonStorage as any)[key];
                return val !== undefined && val !== null ? val : DEFAULT_SETTINGS[key];
            } catch {
                return DEFAULT_SETTINGS[key];
            }
        };

        const translateMessage = async (message: any) => {
            const text = message && message.content;
            if (!text || !text.trim()) {
                showNotice("No text in message to translate", true);
                return;
            }

            const engine = getSetting("engine");
            const source = getSetting("sourceLang");
            const target = getSetting("targetLang");
            const autoCopy = getSetting("autoCopy");
            const braveApiKey = getSetting("braveApiKey");

            try {
                const result = await executeTranslation(
                    text,
                    source,
                    target,
                    engine,
                    braveApiKey
                );
                const formatted = formatResult(
                    result.text,
                    result.detected,
                    source,
                    target,
                    result.engineName
                );

                if (MessageUtil && typeof MessageUtil.sendBotMessage === "function") {
                    // Send an ephemeral message visible only to the current user
                    MessageUtil.sendBotMessage(message.channel_id, formatted);
                } else {
                    Alert.alert("Translate Result", result.text);
                }

                if (autoCopy) {
                    copyText(result.text);
                    showNotice("Translation copied to clipboard!");
                }
            } catch (err: any) {
                const errorMsg = err?.message || String(err);
                logger?.error?.("[Hozy's Translator] Translation error:", err);
                showNotice(`Translation failed: ${errorMsg}`, true);
            }
        };

        if (!LazyActionSheet) {
            logger?.error?.("[Hozy's Translator] LazyActionSheet module not found!");
            return;
        }

        const translateIconAssetId = resolveTranslateIconAsset();

        // Intercept opening of the message action sheet
        const unpatchLazy = safePatchBefore(
            LazyActionSheet,
            "openLazy",
            (args: any[]) => {
                const component = args[0];
                const key = args[1];
                const msgData = args[2];
                const message = msgData && msgData.message;

                if (key !== "MessageLongPressActionSheet" || !message) {
                    return;
                }

                if (component && typeof component.then === "function") {
                    component.then((instance: any) => {
                        if (!instance) return;

                        const unpatchInstance = safePatchAfter(
                            instance,
                            "default",
                            (_: any, tree: any) => {
                                if (!tree) return;

                                const rows = findRowArray(tree);
                                if (!rows || !Array.isArray(rows)) return;

                                // Prevent duplicate injection
                                if (rows.some((r: any) => r?.key === "hozys_translate_row")) {
                                    return;
                                }

                                const sample = rows.find(isRow);
                                if (!sample || !sample.type) return;

                                const handlePress = () => {
                                    try {
                                        if (typeof LazyActionSheet.hideActionSheet === "function") {
                                            LazyActionSheet.hideActionSheet();
                                        }
                                    } catch {}
                                    translateMessage(message);
                                };

                                const isActionSheetRow = !!sample.props?.onPressRow;
                                const rowProps = isActionSheetRow
                                    ? {
                                          key: "hozys_translate_row",
                                          label: "Translate",
                                          message: "Translate",
                                          icon: translateIconAssetId || sample.props?.icon,
                                          onPressRow: handlePress,
                                      }
                                    : {
                                          key: "hozys_translate_row",
                                          label: "Translate",
                                          message: "Translate",
                                          icon: translateIconAssetId || sample.props?.icon,
                                          onPress: handlePress,
                                      };

                                // Insert "Translate" option with the translation icon
                                rows.splice(1, 0, React.createElement(sample.type, rowProps));
                            },
                            logger
                        );

                        // Ensure instance patch is cleaned up
                        cleanup(() => {
                            unpatchInstance();
                        });
                    });
                }
            },
            logger
        );

        // Register main unpatch with the lifecycle cleanup
        cleanup(() => {
            unpatchLazy();
            logger?.info?.("[Hozy's Translator] Plugin unloaded successfully.");
        });
    },

    SettingsComponent({ api }) {
        const storedSettings: Settings = api.jsonStorage.use() ?? DEFAULT_SETTINGS;
        const engine = storedSettings.engine ?? DEFAULT_SETTINGS.engine;
        const sourceLang = storedSettings.sourceLang ?? DEFAULT_SETTINGS.sourceLang;
        const targetLang = storedSettings.targetLang ?? DEFAULT_SETTINGS.targetLang;
        const autoCopy = storedSettings.autoCopy ?? DEFAULT_SETTINGS.autoCopy;
        const braveApiKey = storedSettings.braveApiKey ?? DEFAULT_SETTINGS.braveApiKey;

        const [pickerMode, setPickerMode] = useState<"none" | "engine" | "source" | "target">(
            "none"
        );
        const [query, setQuery] = useState("");

        const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
            if (typeof api.jsonStorage.set === "function") {
                api.jsonStorage.set(key, value);
            } else {
                (api.jsonStorage as any)[key] = value;
            }
        };

        const currentEngineName =
            ENGINES.find((e) => e.id === engine)?.name || "Google Translate";

        const filteredLanguages = useMemo(() => {
            const q = query.trim().toLowerCase();
            const entries = Object.entries(LANGUAGES).filter(
                ([code, name]) =>
                    name.toLowerCase().includes(q) || code.toLowerCase().includes(q)
            );
            if (
                pickerMode === "source" &&
                ("auto-detect".includes(q) || "auto".includes(q) || q === "")
            ) {
                entries.unshift(["auto", "Auto-detect"]);
            }
            return entries;
        }, [query, pickerMode]);

        const handleSelectLanguage = (code: string) => {
            if (pickerMode === "source") {
                updateSetting("sourceLang", code);
            } else if (pickerMode === "target") {
                updateSetting("targetLang", code);
            }
            setPickerMode("none");
            setQuery("");
        };

        const handleSwapLanguages = () => {
            if (sourceLang === "auto") {
                Alert.alert("Swap Error", "Cannot swap when source language is set to Auto-detect.");
                return;
            }
            updateSetting("sourceLang", targetLang);
            updateSetting("targetLang", sourceLang);
        };

        return (
            <ScrollView style={styles.container}>
                {/* Header with Translation Icon */}
                <View style={styles.headerContainer}>
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconSymbol}>🌐</Text>
                    </View>
                    <View style={styles.headerTextGroup}>
                        <Text style={styles.headerTitle}>Hozy's Translator</Text>
                        <Text style={styles.headerSubtitle}>
                            Valenced Edition • Multi-Engine Translation
                        </Text>
                    </View>
                </View>

                {/* Translation Engine Selection */}
                <TableRowGroup title="Translation Engine">
                    <TableRow
                        label="Active Provider"
                        subLabel={currentEngineName}
                        onPress={() => {
                            setPickerMode(pickerMode === "engine" ? "none" : "engine");
                        }}
                    />
                </TableRowGroup>

                {/* Engine Selector Dropdown */}
                {pickerMode === "engine" && (
                    <TableRowGroup title="Select Engine">
                        {ENGINES.map((eng) => {
                            const isSelected = engine === eng.id;
                            return (
                                <TouchableOpacity
                                    key={eng.id}
                                    style={[
                                        styles.engineRow,
                                        isSelected && styles.pickerRowSelected,
                                    ]}
                                    onPress={() => {
                                        updateSetting("engine", eng.id);
                                        setPickerMode("none");
                                    }}
                                >
                                    <View style={styles.engineInfo}>
                                        <Text
                                            style={[
                                                styles.pickerText,
                                                isSelected && styles.pickerTextSelected,
                                            ]}
                                        >
                                            {eng.name}
                                        </Text>
                                        <Text style={styles.engineDesc}>
                                            {eng.description}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <Text style={styles.checkmarkText}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </TableRowGroup>
                )}

                {/* Language Configuration */}
                <TableRowGroup title="Language Configuration">
                    <TableRow
                        label="Translate from"
                        subLabel={getLanguageName(sourceLang)}
                        onPress={() => {
                            setPickerMode(pickerMode === "source" ? "none" : "source");
                            setQuery("");
                        }}
                    />
                    <TableRow
                        label="Translate to"
                        subLabel={getLanguageName(targetLang)}
                        onPress={() => {
                            setPickerMode(pickerMode === "target" ? "none" : "target");
                            setQuery("");
                        }}
                    />
                    {sourceLang !== "auto" && (
                        <TableRow
                            label="Swap Languages"
                            subLabel={`${getLanguageName(sourceLang)} ⇄ ${getLanguageName(targetLang)}`}
                            onPress={handleSwapLanguages}
                        />
                    )}
                </TableRowGroup>

                {/* Language Selector Modal/Dropdown */}
                {(pickerMode === "source" || pickerMode === "target") && (
                    <TableRowGroup
                        title={`Select ${pickerMode === "source" ? "Source" : "Target"} Language`}
                    >
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search language name or code..."
                                placeholderTextColor="#949ba4"
                                value={query}
                                onChangeText={setQuery}
                                autoFocus
                            />
                        </View>
                        <ScrollView
                            style={styles.pickerScrollView}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                        >
                            {filteredLanguages.map(([code, name]) => {
                                const isSelected =
                                    pickerMode === "source"
                                        ? sourceLang === code
                                        : targetLang === code;

                                return (
                                    <TouchableOpacity
                                        key={code}
                                        style={[
                                            styles.pickerRow,
                                            isSelected && styles.pickerRowSelected,
                                        ]}
                                        onPress={() => handleSelectLanguage(code)}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerText,
                                                isSelected && styles.pickerTextSelected,
                                            ]}
                                        >
                                            {name}
                                        </Text>
                                        <Text style={styles.pickerCodeText}>
                                            {code}
                                            {isSelected ? "  ✓" : ""}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </TableRowGroup>
                )}

                {/* Brave Specific Options */}
                {engine === "brave" && (
                    <TableRowGroup title="Brave Options (Optional)">
                        <View style={styles.searchContainer}>
                            <Text style={styles.fieldLabel}>Brave / Lingvanex API Key</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Leave empty for public fallback"
                                placeholderTextColor="#949ba4"
                                value={braveApiKey}
                                onChangeText={(val) => updateSetting("braveApiKey", val)}
                                autoCapitalize="none"
                            />
                        </View>
                    </TableRowGroup>
                )}

                {/* Preferences */}
                <TableRowGroup title="Preferences">
                    <TableSwitchRow
                        label="Auto-copy to Clipboard"
                        subLabel="Automatically copy the translated text to your clipboard"
                        value={autoCopy}
                        onValueChange={(val: boolean) => updateSetting("autoCopy", val)}
                    />
                </TableRowGroup>
            </ScrollView>
        );
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 14,
    },
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2b2d31",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "rgba(88, 101, 242, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    iconSymbol: {
        fontSize: 24,
    },
    headerTextGroup: {
        flex: 1,
    },
    headerTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "bold",
    },
    headerSubtitle: {
        color: "#949ba4",
        fontSize: 12,
        marginTop: 2,
    },
    searchContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    fieldLabel: {
        color: "#dbdee1",
        fontSize: 13,
        marginBottom: 6,
    },
    searchInput: {
        backgroundColor: "#1e1f22",
        borderRadius: 8,
        color: "#ffffff",
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    pickerScrollView: {
        maxHeight: 280,
    },
    pickerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#2b2d31",
    },
    engineRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#2b2d31",
    },
    engineInfo: {
        flex: 1,
    },
    engineDesc: {
        color: "#949ba4",
        fontSize: 12,
        marginTop: 2,
    },
    pickerRowSelected: {
        backgroundColor: "rgba(88, 101, 242, 0.18)",
    },
    pickerText: {
        color: "#dbdee1",
        fontSize: 15,
    },
    pickerTextSelected: {
        color: "#5865f2",
        fontWeight: "bold",
    },
    pickerCodeText: {
        color: "#949ba4",
        fontSize: 13,
    },
    checkmarkText: {
        color: "#5865f2",
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 10,
    },
});
