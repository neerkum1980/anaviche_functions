import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { EventType, PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./config.js";
import { LanguageProvider, useLang } from "./i18n.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Analytics from "./pages/Analytics.jsx";
import Properties from "./pages/Properties.jsx";
import Manage from "./pages/Manage.jsx";
import Accounting from "./pages/Accounting.jsx";
import "./styles.css";

const msalInstance = new PublicClientApplication(msalConfig);

// Old static-site URLs, for hosts that can't redirect them (the storage static website).
const legacyPages = {
  "index_en.html": ["/", "en"],
  "about.html": ["/about"],
  "about_en.html": ["/about", "en"],
  "analytics.html": ["/analytics"],
  "analytics_en.html": ["/analytics", "en"],
  "properties.html": ["/properties"],
  "properties_en.html": ["/properties", "en"],
  "manage.html": ["/manage"],
  "accounting.html": ["/accounting"],
};

function LegacyRedirect({ to, lang }) {
  const { setLang } = useLang();
  useEffect(() => {
    if (lang) setLang(lang);
  }, [lang, setLang]);
  return <Navigate to={to} replace />;
}

async function start() {
  await msalInstance.initialize();
  const result = await msalInstance.handleRedirectPromise().catch((err) => {
    console.error("MSAL redirect error:", err);
    return null;
  });
  const account = result?.account || msalInstance.getAllAccounts()[0];
  if (account) msalInstance.setActiveAccount(account);
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      msalInstance.setActiveAccount(event.payload.account);
    }
  });

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <LanguageProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="about" element={<About />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="properties" element={<Properties />} />
                <Route path="manage" element={<Manage />} />
                <Route path="accounting" element={<Accounting />} />
                {Object.entries(legacyPages).map(([from, to]) => (
                  <Route key={from} path={from} element={<LegacyRedirect to={to[0]} lang={to[1]} />} />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </MsalProvider>
    </StrictMode>
  );
}

start();
