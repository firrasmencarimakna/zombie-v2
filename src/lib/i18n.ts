
"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "../locales/en/translation.json";
import idTranslation from "../locales/id/translation.json";
import gmTranslation from "../locales/gm/translation.json";
import fcTranslation from "../locales/fc/translation.json";
import jpTranslation from "../locales/jp/translation.json";
import spTranslation from "../locales/sp/translation.json";

const resources = {
  en: {
    translation: enTranslation,
  },
  id: {
    translation: idTranslation,
  },
    gm: {
    translation: gmTranslation,
  },
    fc: {
    translation: fcTranslation,
  },
    jp: {
    translation: jpTranslation,
  },
    sp: {
    translation: spTranslation,
  },
};

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // Integrate with React
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "id","gm","fc","jp","sp"],
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ["navigator", "localStorage", "cookie"], // Detection order
      caches: ["localStorage", "cookie"], // Cache language preference
    },
  });

export default i18n;
