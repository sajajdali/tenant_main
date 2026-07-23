import { faMessages } from "./fa";
import type { AppLocale } from "../registry";
import type { MessageKey } from "./fa";

export type { MessageKey } from "./fa";

type MessageMap = Record<MessageKey, string>;

const loadedMessages: Partial<Record<AppLocale, MessageMap>> = {
  fa: faMessages,
};

const messageLoaders = {
  fa: async () => faMessages,
  en: async () => (await import("./en")).enMessages,
  ar: async () => (await import("./ar")).arMessages,
  de: async () => (await import("./de")).deMessages,
} satisfies Record<AppLocale, () => Promise<MessageMap>>;

const loadingPromises: Partial<Record<AppLocale, Promise<MessageMap>>> = {};

export function areMessagesLoaded(locale: AppLocale): boolean {
  return Boolean(loadedMessages[locale]);
}

export async function loadMessages(locale: AppLocale): Promise<MessageMap> {
  const loaded = loadedMessages[locale];
  if (loaded) {
    return loaded;
  }

  loadingPromises[locale] ??= messageLoaders[locale]().then((messages) => {
    loadedMessages[locale] = messages;
    return messages;
  });

  return loadingPromises[locale];
}

export function translate(locale: AppLocale, key: MessageKey, params?: Record<string, string | number>): string {
  const template: string = loadedMessages[locale]?.[key] ?? loadedMessages.fa?.[key] ?? key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}
