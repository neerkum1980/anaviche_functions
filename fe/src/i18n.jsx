import { createContext, useContext, useEffect, useState } from "react";

const LanguageContext = createContext(null);
const STORAGE_KEY = "anaviche-lang";

function initialLang() {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (fromUrl === "de" || fromUrl === "en") return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back to German.
  }
  return "de";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore: the choice just won't be remembered.
    }
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}

// Picks the current language's entry from a { de, en } object.
export function useText(texts) {
  return texts[useLang().lang];
}

export const common = {
  de: {
    nav: {
      home: "Startseite",
      about: "Über uns",
      properties: "Unsere Immobilien",
      analytics: "Analysen",
      manage: "Verwalten",
      accounting: "Buchhaltung",
    },
    switchTo: "EN",
    auth: {
      testMode: "Testmodus (ohne Anmeldung)",
      signedIn: "Angemeldet",
      notSignedIn: "Nicht angemeldet",
      signIn: "Anmelden",
      signOut: "Abmelden",
    },
    pleaseSignIn: "Bitte melden Sie sich an, um fortzufahren.",
  },
  en: {
    nav: {
      home: "Home",
      about: "About Us",
      properties: "Our Properties",
      analytics: "Analytics",
      manage: "Manage",
      accounting: "Accounting",
    },
    switchTo: "DE",
    auth: {
      testMode: "Test mode (no login)",
      signedIn: "Signed in",
      notSignedIn: "Not signed in",
      signIn: "Sign in",
      signOut: "Sign out",
    },
    pleaseSignIn: "Please sign in to continue.",
  },
};
