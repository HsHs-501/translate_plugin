(function () {
  const { findByProps } = vendetta.metro;
  const { React, ReactNative: RN } = vendetta.metro.common;
  const { before, after } = vendetta.patcher;
  const { storage } = vendetta.plugin;
  const { useProxy } = vendetta.storage;
  const { getAssetIDByName } = vendetta.ui.assets;
  const { showToast } = vendetta.ui.toasts;
  const { showConfirmationAlert } = vendetta.ui.alerts;
  const { findInReactTree } = vendetta.utils;
  const { Forms } = vendetta.ui.components;
  const { FormSection, FormRow, FormInput, FormDivider } = Forms;
  const h = React.createElement;

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

  const langName = (code) => (code === "auto" ? "Auto-detect" : LANGUAGES[code] || code);

  async function googleTranslate(text, source, target) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx" +
      "&sl=" + encodeURIComponent(source) +
      "&tl=" + encodeURIComponent(target) +
      "&dt=t&q=" + encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Google Translate error " + res.status);
    const data = await res.json();
    const translated = data[0].map((seg) => seg[0]).join("");
    return { text: translated, detected: data[2] || source };
  }

  function formatResult(result, source, target) {
    const from = source === "auto" ? langName(result.detected) + " (auto)" : langName(source);
    return "🌐 **Translate** — " + from + " ➜ " + langName(target) + "\n" + result.text;
  }

  const MessageUtil = findByProps("sendBotMessage");
  const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

  async function translateMessage(message) {
    const text = message && message.content;
    if (!text || !text.trim()) {
      showToast("No text to translate", getAssetIDByName("Small"));
      return;
    }
    const source = storage.sourceLang || "auto";
    const target = storage.targetLang || "ar";
    try {
      const result = await googleTranslate(text, source, target);
      if (MessageUtil && MessageUtil.sendBotMessage) {
        // Local message: only you can see it
        MessageUtil.sendBotMessage(message.channel_id, formatResult(result, source, target));
      } else {
        showConfirmationAlert({
          title: "Translate",
          content: result.text,
          confirmText: "Okay",
          onConfirm: function () {},
        });
      }
    } catch (e) {
      showToast("Translation failed: " + (e && e.message ? e.message : e), getAssetIDByName("Small"));
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
    const entries = Object.entries(LANGUAGES).filter(
      (e) => (e[1] + " " + e[0]).toLowerCase().includes(q)
    );
    if (props.allowAuto && "auto-detect".includes(q)) entries.unshift(["auto", "Auto-detect"]);

    return h(
      React.Fragment,
      null,
      h(FormRow, {
        label: field === "sourceLang" ? "Translate from" : "Translate to",
        subLabel: langName(storage[field]),
        trailing: FormRow.Arrow ? h(FormRow.Arrow) : undefined,
        onPress: () => setOpen(!open),
      }),
      open &&
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
              label: storage[field] === e[0] ? "✓ " + e[1] : e[1],
              subLabel: e[0],
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
        { title: "Languages", titleStyleType: "no_border" },
        h(Picker, { field: "sourceLang", allowAuto: true }),
        h(FormDivider),
        h(Picker, { field: "targetLang" })
      )
    );
  }

  let patches = [];

  return {
    onLoad: function () {
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
                ? { key: "translate", message: "Translate", onPressRow: onPress }
                : { key: "translate", label: "Translate", onPress: onPress };
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
