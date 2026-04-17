import { useEffect, useMemo, useState } from "react";

import {
  detectLanguage,
  getNestedValue,
  interpolate,
  loadMessages,
} from "../lib/i18n";

export function useI18n() {
  const [state, setState] = useState({
    loading: true,
    language: "en",
    messages: {},
    fallbackMessages: {},
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const loaded = await loadMessages(detectLanguage());

      if (cancelled) {
        return;
      }

      setState({
        loading: false,
        language: loaded.language,
        messages: loaded.messages || {},
        fallbackMessages: loaded.fallbackMessages || loaded.messages || {},
      });
    }

    bootstrap().catch(() => {
      if (cancelled) {
        return;
      }

      setState({
        loading: false,
        language: "en",
        messages: {},
        fallbackMessages: {},
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    function t(key, variables = {}, fallback = key) {
      const primary =
        getNestedValue(state.messages, key) ?? getNestedValue(state.fallbackMessages, key);

      if (typeof primary !== "string") {
        return fallback;
      }

      return interpolate(primary, variables);
    }

    return {
      language: state.language,
      loading: state.loading,
      t,
    };
  }, [state]);
}
