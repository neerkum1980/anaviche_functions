// Build-time settings, set through VITE_* environment variables (see .github/workflows/deploy-frontend.yml and release.yml).
export const API_BASE =
  import.meta.env.VITE_API_BASE || "https://anaviche-functions-test-y1.azurewebsites.net/api/gateway";

// The test site runs without login: the test API accepts anonymous calls.
export const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

// Only the master client's build shows the platform admin (onboarding new clients).
export const ADMIN_ENABLED = import.meta.env.VITE_ADMIN_ENABLED === "true";

export const msalConfig = {
  auth: {
    // Each client stack has its own sign-in app; the release workflow sets these per client.
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || "f72fb2f7-fb7e-4220-be95-440adf112604",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || "9636baf2-1763-480c-8bb3-5689803dbf04"}`,
    // One redirect URI for the whole app; MSAL returns to the page that started the login.
    redirectUri: `${window.location.origin}/`,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE || "api://5a786d75-4a9c-4fc8-bf05-479607dbf471/access_as_user"],
};
