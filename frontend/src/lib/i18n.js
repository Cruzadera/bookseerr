const FALLBACK_LANGUAGE = "en";
const LOCALE_NAMESPACE = "common";

export function normalizeLanguage(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();

  if (normalized.startsWith("es")) {
    return "es-ES";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  return FALLBACK_LANGUAGE;
}

export function detectLanguage() {
  if (typeof navigator === "undefined") {
    return FALLBACK_LANGUAGE;
  }

  return normalizeLanguage(navigator.language || navigator.userLanguage);
}

export function getNestedValue(source, key) {
  return `${key || ""}`
    .split(".")
    .filter(Boolean)
    .reduce((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return value[part];
      }

      return undefined;
    }, source);
}

export function interpolate(template, variables = {}) {
  return `${template || ""}`.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawKey) => {
    const key = `${rawKey || ""}`.trim();
    const value = variables[key];
    return value === undefined || value === null ? "" : `${value}`;
  });
}

export async function loadMessages(language) {
  const normalizedLanguage = normalizeLanguage(language);
  const fallbackUrl = `/locales/${FALLBACK_LANGUAGE}/${LOCALE_NAMESPACE}.json`;
  const languageUrl = `/locales/${normalizedLanguage}/${LOCALE_NAMESPACE}.json`;

  const fallbackResponse = await fetch(fallbackUrl);
  const fallbackMessages = await fallbackResponse.json();

  if (normalizedLanguage === FALLBACK_LANGUAGE) {
    return {
      language: FALLBACK_LANGUAGE,
      messages: fallbackMessages,
      fallbackMessages,
    };
  }

  const languageResponse = await fetch(languageUrl);

  if (!languageResponse.ok) {
    return {
      language: FALLBACK_LANGUAGE,
      messages: fallbackMessages,
      fallbackMessages,
    };
  }

  return {
    language: normalizedLanguage,
    messages: await languageResponse.json(),
    fallbackMessages,
  };
}
