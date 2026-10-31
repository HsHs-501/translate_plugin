(function () {
  const { findByProps } = vendetta.metro;
  const { React, ReactNative: RN } = vendetta.metro.common;
  const { before, after } = vendetta.patcher;
  const { storage } = vendetta.plugin;
  const { useProxy } = vendetta.storage;
  const { showConfirmationAlert } = vendetta.ui.alerts;
  const { findInReactTree } = vendetta.utils;
  const { Forms } = vendetta.ui.components;
  const { FormSection, FormRow, FormInput, FormDivider } = Forms;
  const h = React.createElement;
  const enc = encodeURIComponent;

  const LANGUAGES = {
    af: "Afrikaans", sq: "Albanian", am: "Amharic", ar: "Arabic", hy: "Armenian",
    az: "Azerbaijani", eu: "Basque", be: "Belarusian", bn: "Bengali", bs: "Bosnian",
    bg: "Bulgarian", ca: "Catalan", ceb: "Cebuano", ny: "Chichewa",
    "zh-CN": "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)", co: "Corsican",
    hr: "Croatian", cs: "Czech", da: "Danish", nl: "Dutch", en: "English",
    eo: "Esperanto", et: "Estonian", tl: "Filipino", fi: "Finnish", fr: "French",
    fy: "Frisian", gl: "Galician", ka: "Georgian", de: "German", el: "Greek",
    gu: "Gujarati", ht: "Haitian Creole", ha: "Hausa", haw: "Hawaiian", iw: "Hebrew",
    hi: "Hindi", hmn: "Hmong", hu: "Hungarian", is: "Icelandic", ig: "Igbo",
    id: "Indonesian", ga: "Irish", it: "Italian", ja: "Japanese", jw: "Javanese",
    kn: "Kannada", kk: "Kazakh", km: "Khmer", rw: "Kinyarwanda", ko: "Korean",
    ku: "Kurdish (Kurmanji)", ky: "Kyrgyz", lo: "Lao", la: "Latin", lv: "Latvian",
    lt: "Lithuanian", lb: "Luxembourgish", mk: "Macedonian", mg: "Malagasy",
    ms: "Malay", ml: "Malayalam", mt: "Maltese", mi: "Maori", mr: "Marathi",
    mn: "Mongolian", my: "Myanmar (Burmese)", ne: "Nepali", no: "Norwegian",
    or: "Odia", ps: "Pashto", fa: "Persian", pl: "Polish", pt: "Portuguese",
    pa: "Punjabi", ro: "Romanian", ru: "Russian", sm: "Samoan", gd: "Scots Gaelic",
    sr: "Serbian", st: "Sesotho", sn: "Shona", sd: "Sindhi", si: "Sinhala",
    sk: "Slovak", sl: "Slovenian", so: "Somali", es: "Spanish", su: "Sundanese",
    sw: "Swahili", sv: "Swedish", tg: "Tajik", ta: "Tamil", tt: "Tatar",
    te: "Telugu", th: "Thai", tr: "Turkish", tk: "Turkmen", uk: "Ukrainian",
    ur: "Urdu", ug: "Uyghur", uz: "Uzbek", vi: "Vietnamese", cy: "Welsh",
    xh: "Xhosa", yi: "Yiddish", yo: "Yoruba", zu: "Zulu",
  };

  const PROVIDERS = {
    google: "Google Translate",
    microsoft: "Microsoft Translate",
    brave: "Brave Translate (experimental)",
  };

  const langName = (code) => (code === "auto" ? "Auto-detect" : LANGUAGES[code] || code);
  const providerName = (id) => PROVIDERS[id] || PROVIDERS.google;

  async function googleTranslate(text, source, target) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx" +
      "&sl=" + enc(source) + "&tl=" + enc(target) + "&dt=t&q=" + enc(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Google Translate error " + res.status);
    const data = await res.json();
    return { text: data[0].map((seg) => seg[0]).join(""), detected: data[2] };
  }

  const MS_CODES = { "zh-CN": "zh-Hans", "zh-TW": "zh-Hant", iw: "he", jw: "jv", tl: "fil", no: "nb" };
  const msCode = (code) => MS_CODES[code] || code;
  let msToken = null;

  async function microsoftToken(force) {
    if (!force && msToken && Date.now() - msToken.at < 8 * 60 * 1000) return msToken.value;
    const res = await fetch("https://edge.microsoft.com/translate/auth");
    if (!res.ok) throw new Error("Microsoft auth error " + res.status);
    const value = (await res.text()).trim();
    msToken = { value: value, at: Date.now() };
    return value;
  }

  async function microsoftTranslate(text, source, target) {
    const url =
      "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0" +
      "&to=" + enc(msCode(target)) +
      (source === "auto" ? "" : "&from=" + enc(msCode(source)));
    const call = (token) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify([{ Text: text }]),
      });
    let res = await call(await microsoftToken(false));
    if (res.status === 401) res = await call(await microsoftToken(true));
    if (!res.ok) throw new Error("Microsoft Translate error " + res.status);
    const data = await res.json();
    const translated = data && data[0] && data[0].translations && data[0].translations[0] && data[0].translations[0].text;
    if (typeof translated !== "string") throw new Error("Unexpected Microsoft Translate response");
    return { text: translated, detected: data[0].detectedLanguage && data[0].detectedLanguage.language };
  }

  async function braveTranslate(text, source, target) {
    const url =
      "https://translate.brave.com/translate_a/t?anno=3&client=te_lib&format=text&v=1.0" +
      "&sl=" + enc(source) + "&tl=" + enc(target) + "&tc=1&sr=1&mode=1";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "q=" + enc(text),
    });
    if (!res.ok) throw new Error("Brave Translate error " + res.status);
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    const translated = Array.isArray(first) ? first[0] : first;
    if (typeof translated !== "string") throw new Error("Unexpected Brave Translate response");
    return { text: translated, detected: Array.isArray(first) ? first[1] : undefined };
  }

  function translate(provider, text, source, target) {
    if (provider === "microsoft") return microsoftTranslate(text, source, target);
    if (provider === "brave") return braveTranslate(text, source, target);
    return googleTranslate(text, source, target);
  }

  function formatResult(result, provider, source, target) {
    const from =
      source === "auto"
        ? result.detected ? langName(result.detected) + " (auto)" : "Auto-detect"
        : langName(source);
    return "🌐 **Hozy's Translator** (" + providerName(provider) + ")\n" +
      from + " ➜ " + langName(target) + "\n" + result.text;
  }

  const MessageUtil = findByProps("sendBotMessage");
  const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

  function notify(channelId, text) {
    if (channelId && MessageUtil && MessageUtil.sendBotMessage) {
      MessageUtil.sendBotMessage(channelId, text);
    } else {
      showConfirmationAlert({
        title: "Hozy's Translator",
        content: text,
        confirmText: "Okay",
        onConfirm: function () {},
      });
    }
  }

  async function translateMessage(message) {
    const text = message && message.content;
    if (!text || !text.trim()) {
      notify(message && message.channel_id, "⚠️ No text to translate");
      return;
    }
    const provider = storage.provider || "google";
    const source = storage.sourceLang || "auto";
    const target = storage.targetLang || "ar";
    try {
      const result = await translate(provider, text, source, target);
      notify(message.channel_id, formatResult(result, provider, source, target));
    } catch (e) {
      notify(message.channel_id, "⚠️ Translation failed: " + (e && e.message ? e.message : e));
    }
  }

  const isRow = (el) =>
    !!(el && el.props &&
      (typeof el.props.label === "string" || typeof el.props.message === "string") &&
      (typeof el.props.onPress === "function" || typeof el.props.onPressRow === "function"));

  function findRowArray(node, depth) {
    depth = depth || 0;
    if (!node || typeof node !== "object" || depth > 15) return;
    const children = node.props && node.props.children;
    if (Array.isArray(children)) {
      if (children.some(isRow)) return children;
      for (const child of children) {
        const found = findRowArray(child, depth + 1);
        if (found) return found;
      }
    } else if (children) {
      return findRowArray(children, depth + 1);
    }
  }

  function Picker(props) {
    const field = props.field;
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    useProxy(storage);

    const q = query.trim().toLowerCase();
    let entries;
    if (field === "provider") {
      entries = Object.entries(PROVIDERS);
    } else {
      entries = Object.entries(LANGUAGES).filter(
        (e) => (e[1] + " " + e[0]).toLowerCase().includes(q)
      );
      if (props.allowAuto && "auto-detect".includes(q)) entries.unshift(["auto", "Auto-detect"]);
    }
    const current = storage[field];
    const currentLabel = field === "provider" ? providerName(current) : langName(current);

    return h(
      React.Fragment,
      null,
      h(FormRow, {
        label: props.label,
        subLabel: currentLabel,
        trailing: FormRow.Arrow ? h(FormRow.Arrow) : undefined,
        onPress: () => setOpen(!open),
      }),
      open && field !== "provider" &&
        h(FormInput, {
          title: "Search",
          placeholder: "Search language...",
          value: query,
          onChange: setQuery,
        }),
      open &&
        h(
          RN.ScrollView,
          { style: { maxHeight: 320 }, nestedScrollEnabled: true },
          entries.map((e) =>
            h(FormRow, {
              key: e[0],
              label: current === e[0] ? "✓ " + e[1] : e[1],
              subLabel: field === "provider" ? undefined : e[0],
              onPress: () => {
                storage[field] = e[0];
                setOpen(false);
                setQuery("");
              },
            })
          )
        )
    );
  }

  function Settings() {
    useProxy(storage);
    return h(
      RN.ScrollView,
      null,
      h(
        FormSection,
        { title: "Hozy's Translator", titleStyleType: "no_border" },
        h(Picker, { field: "provider", label: "Translation service" }),
        h(FormDivider),
        h(Picker, { field: "sourceLang", label: "Translate from", allowAuto: true }),
        h(FormDivider),
        h(Picker, { field: "targetLang", label: "Translate to" })
      )
    );
  }

  let patches = [];

  return {
    onLoad: function () {
      if (!storage.provider) storage.provider = "google";
      if (!storage.sourceLang) storage.sourceLang = "auto";
      if (!storage.targetLang) storage.targetLang = "ar";

      patches.push(
        before("openLazy", LazyActionSheet, function (args) {
          const component = args[0];
          const key = args[1];
          const msg = args[2];
          const message = msg && msg.message;
          if (key !== "MessageLongPressActionSheet" || !message) return;

          component.then(function (instance) {
            const unpatch = after("default", instance, function (_, tree) {
              React.useEffect(function () {
                return function () { unpatch(); };
              }, []);

              const rows = findRowArray(tree);
              if (!rows) return;
              const sample = rows.find(isRow);
              const onPress = function () {
                LazyActionSheet.hideActionSheet();
                translateMessage(message);
              };
              const rowProps = sample.props.onPressRow
                ? { key: "hozy-translate", message: "Translate", onPressRow: onPress }
                : { key: "hozy-translate", label: "Translate", onPress: onPress };
              rows.splice(1, 0, h(sample.type, rowProps));
            });
          });
        })
      );
    },
    onUnload: function () {
      patches.forEach(function (p) { p(); });
      patches = [];
    },
    settings: Settings,
  };
})()
