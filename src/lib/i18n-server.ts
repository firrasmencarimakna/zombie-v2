
import i18n from "i18next";
import enTranslation from "../locales/en/translation.json";
import idTranslation from "../locales/id/translation.json";
import gmTranslation from "../locales/gm/translation.json";
import fcTranslation from "../locales/fc/translation.json";
import jpTranslation from "../locales/fc/translation.json";
import spTranslation from "../locales/sp/translation.json";

// Initialize i18next for server-side
i18n.init({
  resources: {
    en: { translation: enTranslation },
    id: { translation: idTranslation },
    gm: { translation: gmTranslation},
    fc: { translation: fcTranslation},
    jp: { translation: jpTranslation},
    sp: { translation: spTranslation},
    

  },
  fallbackLng: "en",
  supportedLngs: ["en", "id","gm","fc","jp","sp"],
  interpolation: {
    escapeValue: false, // No need for escaping in server context
  },
});

export default i18n;
