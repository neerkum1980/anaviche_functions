import { useCallback } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { API_BASE, AUTH_DISABLED, loginRequest } from "./config.js";

export class ApiError extends Error {
  constructor(status, body) {
    super(`API error ${status}${body ? `: ${body}` : ""}`);
    this.status = status;
  }
}

// Returns fetch(path, options) against the gateway, adding a bearer token unless auth is disabled.
export function useApi() {
  const { instance } = useMsal();

  return useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      if (!AUTH_DISABLED) {
        const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
        if (!account) throw new Error("Please sign in to continue.");
        try {
          const result = await instance.acquireTokenSilent({ ...loginRequest, account });
          headers.set("Authorization", `Bearer ${result.accessToken}`);
        } catch (err) {
          if (err instanceof InteractionRequiredAuthError) {
            await instance.acquireTokenRedirect(loginRequest);
          }
          throw err;
        }
      }
      const res = await fetch(`${API_BASE}/${path}`, { ...options, headers });
      if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ""));
      return res;
    },
    [instance]
  );
}

export function useSignedIn() {
  const isAuthenticated = useIsAuthenticated();
  return AUTH_DISABLED || isAuthenticated;
}

export function AuthBar({ labels }) {
  const { instance, accounts } = useMsal();
  const signedIn = useIsAuthenticated();

  if (AUTH_DISABLED) {
    return <div className="auth-actions"><span className="auth-user">{labels.testMode}</span></div>;
  }
  const account = instance.getActiveAccount() || accounts[0];
  return (
    <div className="auth-actions">
      <span className="auth-user">
        {signedIn ? account?.username || account?.name || labels.signedIn : labels.notSignedIn}
      </span>
      {signedIn ? (
        <button type="button" onClick={() => instance.logoutRedirect({ account })}>{labels.signOut}</button>
      ) : (
        <button type="button" onClick={() => instance.loginRedirect(loginRequest)}>{labels.signIn}</button>
      )}
    </div>
  );
}

// Shows children only when signed in (always, when auth is disabled).
export function RequireSignIn({ message, children }) {
  return useSignedIn() ? children : <p className="notice">{message}</p>;
}
