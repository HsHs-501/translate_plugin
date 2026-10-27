// index.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert
} from "react-native";
import { plugin, patcher } from "@valenced/api";
import { findByProps } from "@valenced/discord/metro";
import { Design } from "@valenced/discord/design";
var DEFAULT_SETTINGS = {
  engine: "google",
  sourceLang: "auto",
  targetLang: "ar",
  autoCopy: false,
  braveApiKey: ""
};
var ENGINES = [
  {
    id: "google",
    name: "Google Translate",
    description: "Fast, accurate, and supports over 100 languages."
  },
  {
    id: "microsoft",
    name: "Microsoft Translator",
    description: "Bing Translator engine with robust multi-language detection."
  },
  {
    id: "brave",
    name: "Brave Translator",
    description: "Privacy-focused translator powered by Brave & Lingvanex."
  }
];
var LANGUAGES = {
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
  zu: "Zulu"
};
var getLanguageName = (code) => {
  if (code === "auto") return "Auto-detect";
  return LANGUAGES[code] || code;
};
async function googleTranslate(text, source, target) {
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(source) + "&tl=" + encodeURIComponent(target) + "&dt=t&q=" + encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Translate error ${res.status}`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data[0])) {
    throw new Error("Invalid response received from Google Translate");
  }
  const translated = data[0].map((seg) => seg[0]).join("");
  const detected = data[2] || source;
  return { text: translated, detected };
}
var cachedBingToken = null;
var bingTokenExpiry = 0;
async function getBingToken() {
  const now = Date.now();
  if (cachedBingToken && now < bingTokenExpiry) {
    return cachedBingToken;
  }
  const res = await fetch("https://www.bing.com/translator", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to access Bing Translator: ${res.status}`);
  }
  const html = await res.text();
  const igMatch = html.match(/IG:"([^"]+)"/);
  const paramsMatch = html.match(
    /params_AbusePreventionHelper\s*=\s*\[([0-9]+),"([^"]+)"/
  );
  if (!igMatch || !paramsMatch) {
    throw new Error("Could not extract Microsoft Translator parameters");
  }
  cachedBingToken = {
    ig: igMatch[1],
    key: paramsMatch[1],
    token: paramsMatch[2]
  };
  bingTokenExpiry = now + 10 * 60 * 1e3;
  return cachedBingToken;
}
async function microsoftTranslate(text, source, target) {
  const { ig, key, token } = await getBingToken();
  const fromLang = source === "auto" || !source ? "auto-detect" : source;
  const body = new URLSearchParams({
    fromLang,
    text,
    to: target,
    token,
    key
  });
  const res = await fetch(
    `https://www.bing.com/ttranslatev3?isVertical=1&&IG=${ig}&IID=translator.5028`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://www.bing.com/translator"
      },
      body: body.toString()
    }
  );
  if (!res.ok) {
    throw new Error(`Microsoft Translator error: ${res.status}`);
  }
  const data = await res.json();
  if (!data || !data[0] || !data[0].translations || !data[0].translations[0]) {
    throw new Error("Invalid response format received from Microsoft Translator");
  }
  const translated = data[0].translations[0].text;
  const detected = data[0].detectedLanguage ? data[0].detectedLanguage.language : source;
  return { text: translated, detected };
}
async function braveTranslate(text, source, target, apiKey) {
  try {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Brave/122.0.0.0"
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
        target_lang: target
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.translations && data.translations[0]?.text) {
        return {
          text: data.translations[0].text,
          detected: data.detected_lang || source
        };
      }
    }
  } catch {
  }
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
          detected: data.responseData.detectedLanguage || source
        };
      }
    }
  } catch {
  }
  return microsoftTranslate(text, source, target);
}
async function executeTranslation(text, source, target, engine, braveApiKey) {
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
function formatResult(text, detected, source, target, engineName) {
  const fromLabel = source === "auto" ? `${getLanguageName(detected)} (auto)` : getLanguageName(source);
  const toLabel = getLanguageName(target);
  return `\u{1F310} **Translate (${engineName})** \u2022 ${fromLabel} \u2794 ${toLabel}
${text}`;
}
var isRow = (el) => !!(el && el.props && (typeof el.props.label === "string" || typeof el.props.message === "string") && (typeof el.props.onPress === "function" || typeof el.props.onPressRow === "function"));
function findRowArray(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 15) return void 0;
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
  return void 0;
}
function resolveTranslateIconAsset() {
  try {
    const Assets = findByProps("getAssetIDByName");
    if (!Assets || typeof Assets.getAssetIDByName !== "function") return void 0;
    const candidateNames = [
      "ic_message_actions_translate",
      "ic_translate_24px",
      "TranslateIcon",
      "ic_locale_24px",
      "ic_language_24px",
      "LanguageIcon",
      "ic_globe_24px",
      "GlobeIcon"
    ];
    for (const name of candidateNames) {
      try {
        const id = Assets.getAssetIDByName(name);
        if (id !== void 0 && id !== null) return id;
      } catch {
      }
    }
  } catch {
  }
  return void 0;
}
function safePatchBefore(target, method, callback, logger) {
  if (!target || !target[method]) return () => {
  };
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
  target[method] = function(...args) {
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
function safePatchAfter(target, method, callback, logger) {
  if (!target || !target[method]) return () => {
  };
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
  target[method] = function(...args) {
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
var index_default = plugin({
  // Eagerly load settings file with defaults (per official Valenced spec)
  jsonStorage: {
    load: true,
    default: DEFAULT_SETTINGS
  },
  start({ cleanup, jsonStorage, logger }) {
    logger?.log?.("[Hozy's Translator] Starting Valenced Translator...");
    const MessageUtil = findByProps("sendBotMessage");
    const LazyActionSheet = findByProps("openLazy", "hideActionSheet") || findByProps("openLazy");
    const ToastUtil = findByProps("showToast");
    const ToastIcons = findByProps("getAssetIDByName");
    const ClipboardUtil = findByProps("setString", "getString");
    const showNotice = (content, isError = false) => {
      try {
        if (ToastUtil && typeof ToastUtil.showToast === "function") {
          const icon = ToastIcons?.getAssetIDByName ? ToastIcons.getAssetIDByName(isError ? "Small" : "Checkmark") : void 0;
          ToastUtil.showToast(content, icon);
          return;
        }
      } catch {
      }
      Alert.alert("Hozy's Translator", content);
    };
    const copyText = (content) => {
      try {
        if (ClipboardUtil && typeof ClipboardUtil.setString === "function") {
          ClipboardUtil.setString(content);
        } else if (Clipboard && typeof Clipboard.setString === "function") {
          Clipboard.setString(content);
        }
      } catch {
      }
    };
    const getSetting = (key) => {
      return jsonStorage.cache?.[key] ?? (typeof jsonStorage.get === "function" ? jsonStorage.get(key) : void 0) ?? DEFAULT_SETTINGS[key];
    };
    const translateMessage = async (message) => {
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
          MessageUtil.sendBotMessage(message.channel_id, formatted);
        } else {
          Alert.alert("Translate Result", result.text);
        }
        if (autoCopy) {
          copyText(result.text);
          showNotice("Translation copied to clipboard!");
        }
      } catch (err) {
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
    const unpatchLazy = safePatchBefore(
      LazyActionSheet,
      "openLazy",
      (args) => {
        const component = args[0];
        const key = args[1];
        const msgData = args[2];
        const message = msgData && msgData.message;
        if (key !== "MessageLongPressActionSheet" || !message) {
          return;
        }
        if (component && typeof component.then === "function") {
          component.then((instance) => {
            if (!instance) return;
            const unpatchInstance = safePatchAfter(
              instance,
              "default",
              (_, tree) => {
                if (!tree) return;
                const rows = findRowArray(tree);
                if (!rows || !Array.isArray(rows)) return;
                if (rows.some((r) => r?.key === "hozys_translate_row")) {
                  return;
                }
                const sample = rows.find(isRow);
                if (!sample || !sample.type) return;
                const handlePress = () => {
                  try {
                    if (typeof LazyActionSheet.hideActionSheet === "function") {
                      LazyActionSheet.hideActionSheet();
                    }
                  } catch {
                  }
                  translateMessage(message);
                };
                const isActionSheetRow = !!sample.props?.onPressRow;
                const rowProps = isActionSheetRow ? {
                  key: "hozys_translate_row",
                  label: "Translate",
                  message: "Translate",
                  icon: translateIconAssetId || sample.props?.icon,
                  onPressRow: handlePress
                } : {
                  key: "hozys_translate_row",
                  label: "Translate",
                  message: "Translate",
                  icon: translateIconAssetId || sample.props?.icon,
                  onPress: handlePress
                };
                rows.splice(1, 0, React.createElement(sample.type, rowProps));
              },
              logger
            );
            cleanup(() => {
              unpatchInstance();
            });
          });
        }
      },
      logger
    );
    cleanup(() => {
      unpatchLazy();
      logger?.log?.("[Hozy's Translator] Plugin unloaded successfully.");
    });
  },
  SettingsComponent({ api }) {
    const TableRowGroup = Design?.TableRowGroup ?? View;
    const TableRow = Design?.TableRow ?? View;
    const TableSwitchRow = Design?.TableSwitchRow ?? View;
    const storedSettings = api.jsonStorage.use() ?? DEFAULT_SETTINGS;
    const engine = storedSettings.engine ?? DEFAULT_SETTINGS.engine;
    const sourceLang = storedSettings.sourceLang ?? DEFAULT_SETTINGS.sourceLang;
    const targetLang = storedSettings.targetLang ?? DEFAULT_SETTINGS.targetLang;
    const autoCopy = storedSettings.autoCopy ?? DEFAULT_SETTINGS.autoCopy;
    const braveApiKey = storedSettings.braveApiKey ?? DEFAULT_SETTINGS.braveApiKey;
    const [pickerMode, setPickerMode] = useState(
      "none"
    );
    const [query, setQuery] = useState("");
    const updateSetting = (key, value) => {
      api.jsonStorage.set({ [key]: value });
    };
    const currentEngineName = ENGINES.find((e) => e.id === engine)?.name || "Google Translate";
    const filteredLanguages = useMemo(() => {
      const q = query.trim().toLowerCase();
      const entries = Object.entries(LANGUAGES).filter(
        ([code, name]) => name.toLowerCase().includes(q) || code.toLowerCase().includes(q)
      );
      if (pickerMode === "source" && ("auto-detect".includes(q) || "auto".includes(q) || q === "")) {
        entries.unshift(["auto", "Auto-detect"]);
      }
      return entries;
    }, [query, pickerMode]);
    const handleSelectLanguage = (code) => {
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
      api.jsonStorage.set({
        sourceLang: targetLang,
        targetLang: sourceLang
      });
    };
    return /* @__PURE__ */ React.createElement(ScrollView, { style: styles.container }, /* @__PURE__ */ React.createElement(View, { style: styles.headerContainer }, /* @__PURE__ */ React.createElement(View, { style: styles.iconCircle }, /* @__PURE__ */ React.createElement(Text, { style: styles.iconSymbol }, "\u{1F310}")), /* @__PURE__ */ React.createElement(View, { style: styles.headerTextGroup }, /* @__PURE__ */ React.createElement(Text, { style: styles.headerTitle }, "Hozy's Translator"), /* @__PURE__ */ React.createElement(Text, { style: styles.headerSubtitle }, "Valenced Edition \u2022 Multi-Engine Translation"))), /* @__PURE__ */ React.createElement(TableRowGroup, { title: "Translation Engine" }, /* @__PURE__ */ React.createElement(
      TableRow,
      {
        label: "Active Provider",
        subLabel: currentEngineName,
        onPress: () => {
          setPickerMode(pickerMode === "engine" ? "none" : "engine");
        }
      }
    )), pickerMode === "engine" && /* @__PURE__ */ React.createElement(TableRowGroup, { title: "Select Engine" }, ENGINES.map((eng) => {
      const isSelected = engine === eng.id;
      return /* @__PURE__ */ React.createElement(
        TouchableOpacity,
        {
          key: eng.id,
          style: [
            styles.engineRow,
            isSelected && styles.pickerRowSelected
          ],
          onPress: () => {
            updateSetting("engine", eng.id);
            setPickerMode("none");
          }
        },
        /* @__PURE__ */ React.createElement(View, { style: styles.engineInfo }, /* @__PURE__ */ React.createElement(
          Text,
          {
            style: [
              styles.pickerText,
              isSelected && styles.pickerTextSelected
            ]
          },
          eng.name
        ), /* @__PURE__ */ React.createElement(Text, { style: styles.engineDesc }, eng.description)),
        isSelected && /* @__PURE__ */ React.createElement(Text, { style: styles.checkmarkText }, "\u2713")
      );
    })), /* @__PURE__ */ React.createElement(TableRowGroup, { title: "Language Configuration" }, /* @__PURE__ */ React.createElement(
      TableRow,
      {
        label: "Translate from",
        subLabel: getLanguageName(sourceLang),
        onPress: () => {
          setPickerMode(pickerMode === "source" ? "none" : "source");
          setQuery("");
        }
      }
    ), /* @__PURE__ */ React.createElement(
      TableRow,
      {
        label: "Translate to",
        subLabel: getLanguageName(targetLang),
        onPress: () => {
          setPickerMode(pickerMode === "target" ? "none" : "target");
          setQuery("");
        }
      }
    ), sourceLang !== "auto" && /* @__PURE__ */ React.createElement(
      TableRow,
      {
        label: "Swap Languages",
        subLabel: `${getLanguageName(sourceLang)} \u21C4 ${getLanguageName(targetLang)}`,
        onPress: handleSwapLanguages
      }
    )), (pickerMode === "source" || pickerMode === "target") && /* @__PURE__ */ React.createElement(
      TableRowGroup,
      {
        title: `Select ${pickerMode === "source" ? "Source" : "Target"} Language`
      },
      /* @__PURE__ */ React.createElement(View, { style: styles.searchContainer }, /* @__PURE__ */ React.createElement(
        TextInput,
        {
          style: styles.searchInput,
          placeholder: "Search language name or code...",
          placeholderTextColor: "#949ba4",
          value: query,
          onChangeText: setQuery,
          autoFocus: true
        }
      )),
      /* @__PURE__ */ React.createElement(
        ScrollView,
        {
          style: styles.pickerScrollView,
          nestedScrollEnabled: true,
          showsVerticalScrollIndicator: true
        },
        filteredLanguages.map(([code, name]) => {
          const isSelected = pickerMode === "source" ? sourceLang === code : targetLang === code;
          return /* @__PURE__ */ React.createElement(
            TouchableOpacity,
            {
              key: code,
              style: [
                styles.pickerRow,
                isSelected && styles.pickerRowSelected
              ],
              onPress: () => handleSelectLanguage(code)
            },
            /* @__PURE__ */ React.createElement(
              Text,
              {
                style: [
                  styles.pickerText,
                  isSelected && styles.pickerTextSelected
                ]
              },
              name
            ),
            /* @__PURE__ */ React.createElement(Text, { style: styles.pickerCodeText }, code, isSelected ? "  \u2713" : "")
          );
        })
      )
    ), engine === "brave" && /* @__PURE__ */ React.createElement(TableRowGroup, { title: "Brave Options (Optional)" }, /* @__PURE__ */ React.createElement(View, { style: styles.searchContainer }, /* @__PURE__ */ React.createElement(Text, { style: styles.fieldLabel }, "Brave / Lingvanex API Key"), /* @__PURE__ */ React.createElement(
      TextInput,
      {
        style: styles.searchInput,
        placeholder: "Leave empty for public fallback",
        placeholderTextColor: "#949ba4",
        value: braveApiKey,
        onChangeText: (val) => updateSetting("braveApiKey", val),
        autoCapitalize: "none"
      }
    ))), /* @__PURE__ */ React.createElement(TableRowGroup, { title: "Preferences" }, /* @__PURE__ */ React.createElement(
      TableSwitchRow,
      {
        label: "Auto-copy to Clipboard",
        subLabel: "Automatically copy the translated text to your clipboard",
        value: autoCopy,
        onValueChange: (val) => updateSetting("autoCopy", val)
      }
    )));
  }
});
var styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2b2d31",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(88, 101, 242, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14
  },
  iconSymbol: {
    fontSize: 24
  },
  headerTextGroup: {
    flex: 1
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold"
  },
  headerSubtitle: {
    color: "#949ba4",
    fontSize: 12,
    marginTop: 2
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  fieldLabel: {
    color: "#dbdee1",
    fontSize: 13,
    marginBottom: 6
  },
  searchInput: {
    backgroundColor: "#1e1f22",
    borderRadius: 8,
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  pickerScrollView: {
    maxHeight: 280
  },
  pickerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2d31"
  },
  engineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2b2d31"
  },
  engineInfo: {
    flex: 1
  },
  engineDesc: {
    color: "#949ba4",
    fontSize: 12,
    marginTop: 2
  },
  pickerRowSelected: {
    backgroundColor: "rgba(88, 101, 242, 0.18)"
  },
  pickerText: {
    color: "#dbdee1",
    fontSize: 15
  },
  pickerTextSelected: {
    color: "#5865f2",
    fontWeight: "bold"
  },
  pickerCodeText: {
    color: "#949ba4",
    fontSize: 13
  },
  checkmarkText: {
    color: "#5865f2",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10
  }
});
export {
  ENGINES,
  LANGUAGES,
  index_default as default,
  getLanguageName
};
