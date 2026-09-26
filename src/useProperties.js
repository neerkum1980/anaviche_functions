import { useCallback, useEffect, useState } from "react";
import { useApi, useSignedIn } from "./auth.jsx";

// Loads the property list once signed in; reload() fetches it again.
export function useProperties() {
  const api = useApi();
  const signedIn = useSignedIn();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("properties");
      setProperties(await res.json());
    } catch (err) {
      console.error("Failed to load properties:", err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (signedIn) reload();
  }, [signedIn, reload]);

  return { properties, loading, error, reload };
}
