import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCheck,
  Loader2,
  Paperclip,
  SendHorizonal,
  ShieldCheck,
  SmilePlus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoginModal } from "@/components/login-modal";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { subscribeOnlineChatUserUpdates } from "@/lib/realtime";
import type { OnlineChatConversationDetails, OnlineChatMessage, TenantMeta } from "@/lib/types";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { playChatNotificationSound } from "@/lib/chat-notification-sound";
import { useFormat, useLocale, useT } from "@/i18n/locale";

function formatMessageTime(value: string | null | undefined, formatter: ReturnType<typeof useFormat>) {
  if (!value) return "";
  return formatter.time(value, { hour: "2-digit", minute: "2-digit" });
}

function formatMessageDay(value: string | null | undefined, formatter: ReturnType<typeof useFormat>) {
  if (!value) return "";

  return formatter.date(value, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function attachmentSizeLabel(size: number, formatter: ReturnType<typeof useFormat>, t: ReturnType<typeof useT>) {
  if (size >= 1024 * 1024) {
    return t("panelOnlineChat.units.megabyte", { value: formatter.number(Number((size / (1024 * 1024)).toFixed(1))) });
  }

  return t("panelOnlineChat.units.kilobyte", { value: formatter.number(Math.max(1, Math.round(size / 1024))) });
}

function isImageMimeType(mimeType?: string | null) {
  return String(mimeType ?? "").toLowerCase().startsWith("image/");
}

const MAX_CHAT_ATTACHMENTS = 5;
const MAX_CHAT_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_CHAT_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isAllowedChatAttachment(file: File) {
  if (ALLOWED_CHAT_ATTACHMENT_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

function sortMessagesAsc(messages: OnlineChatMessage[]) {
  return [...messages].sort((a, b) => Number(a.id) - Number(b.id));
}

function mergeMessages(existing: OnlineChatMessage[], incoming: OnlineChatMessage[]) {
  const items = new Map<string, OnlineChatMessage>();

  for (const message of [...existing, ...incoming]) {
    items.set(message.id, message);
  }

  return sortMessagesAsc(Array.from(items.values()));
}

export default function SupportChatRoomPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [metaLoaded, setMetaLoaded] = useState(() => Boolean(getInitialTenantMeta()));
  const [draft, setDraft] = useState("");
  const [conversationDetails, setConversationDetails] = useState<OnlineChatConversationDetails>({
    conversation: null,
    messages: [],
    messagesMeta: {
      hasOlder: false,
      oldestMessageId: null,
    },
  });
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showIntroNotice, setShowIntroNotice] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const firstRealtimeEventSkippedRef = useRef(false);
  const shouldScrollToBottomRef = useRef(false);
  const prependScrollStateRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(null);
  const quickEmojis = ["🙂", "😊", "😍", "🤔", "🙏", "💚", "👌", "👏", "🔥", "🍎", "🥗", "💪", "😅", "🤍", "🌿", "✨", "😋", "😎", "🤝", "❤️"];
  const metaReady = metaLoaded || Array.isArray(tenantMeta?.activeFeatureModules) || typeof tenantMeta?.onlineChatSettings?.moduleActive === "boolean";
  const moduleActive = tenantMeta?.onlineChatSettings?.moduleActive
    ?? tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat")
    ?? false;
  const isConversationClosed = conversationDetails.conversation?.status === "closed";

  const orderedMessages = useMemo(() => sortMessagesAsc(conversationDetails.messages), [conversationDetails.messages]);
  const attachedFilePreviews = useMemo(
    () => attachedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachedFiles],
  );

  const scrollMessagesToBottom = () => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  };

  useEffect(() => {
    return () => {
      attachedFilePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [attachedFilePreviews]);

  const loadMeta = async () => {
    try {
      const res = await api.meta.get();

      if (res.success) {
        setTenantMeta(res.data);
      }
    } finally {
      setMetaLoaded(true);
    }
  };

  const syncConversationDetails = (
    incoming: OnlineChatConversationDetails,
    options?: { appendOlder?: boolean; preserveOlderMessages?: boolean },
  ) => {
    setConversationDetails((current) => {
      if (options?.appendOlder) {
        return {
          conversation: incoming.conversation,
          messages: mergeMessages(incoming.messages, current.messages),
          messagesMeta: incoming.messagesMeta,
        };
      }

      const mergedMessages = options?.preserveOlderMessages
        ? mergeMessages(current.messages, incoming.messages)
        : sortMessagesAsc(incoming.messages);

      const hasPreservedOlderMessages = current.messages.length > incoming.messages.length;

      return {
        conversation: incoming.conversation,
        messages: mergedMessages,
        messagesMeta: options?.preserveOlderMessages && hasPreservedOlderMessages
          ? current.messagesMeta
          : incoming.messagesMeta,
      };
    });
  };

  const loadConversation = async (options?: { silent?: boolean; beforeMessageId?: string | null; appendOlder?: boolean; preserveOlderMessages?: boolean }) => {
    if (!options?.silent) {
      if (options?.appendOlder) {
        setLoadingOlder(true);
      } else {
        setLoading(true);
      }
    }

    try {
      const res = await api.onlineChat.me(options?.beforeMessageId);

      if (!res.success) {
        if (options?.appendOlder) {
          prependScrollStateRef.current = null;
        }
        toast({ variant: "destructive", title: t("common.error"), description: res.message || t("supportChatRoom.toast.loadFailed") });
        return;
      }

      syncConversationDetails(res.data, {
        appendOlder: options?.appendOlder,
        preserveOlderMessages: options?.preserveOlderMessages,
      });
    } catch {
      if (options?.appendOlder) {
        prependScrollStateRef.current = null;
      }
      toast({ variant: "destructive", title: t("common.error"), description: t("supportChatRoom.toast.connectionFailed") });
    } finally {
      if (!options?.silent) {
        if (options?.appendOlder) {
          setLoadingOlder(false);
        } else {
          setLoading(false);
        }
      }
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    if (!metaReady || !moduleActive) {
      setLoading(false);
      return;
    }

    shouldScrollToBottomRef.current = true;
    void loadConversation();
  }, [isAuthenticated, metaReady, moduleActive]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    return subscribeOnlineChatUserUpdates(user.id, (payload) => {
      const action = payload.action;

      if (firstRealtimeEventSkippedRef.current) {
        if (action === "message_sent_by_admin") {
          void playChatNotificationSound();
        }
      } else {
        firstRealtimeEventSkippedRef.current = true;
      }

      shouldScrollToBottomRef.current = true;
      void loadConversation({ silent: true, preserveOlderMessages: true });
    });
  }, [user?.id]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    if (prependScrollStateRef.current) {
      const { previousScrollHeight, previousScrollTop } = prependScrollStateRef.current;
      const delta = container.scrollHeight - previousScrollHeight;
      container.scrollTop = previousScrollTop + delta;
      prependScrollStateRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollMessagesToBottom();
        });
      });
      shouldScrollToBottomRef.current = false;
    }
  }, [orderedMessages]);

  useEffect(() => {
    if (loading || orderedMessages.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollMessagesToBottom();
      });
    });
  }, [loading, orderedMessages.length]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (
        container.scrollTop > 80 ||
        loadingOlder ||
        loading ||
        !conversationDetails.messagesMeta.hasOlder ||
        !conversationDetails.messagesMeta.oldestMessageId
      ) {
        return;
      }

      prependScrollStateRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };

      void loadConversation({
        beforeMessageId: conversationDetails.messagesMeta.oldestMessageId,
        appendOlder: true,
      });
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [conversationDetails.messagesMeta.hasOlder, conversationDetails.messagesMeta.oldestMessageId, loading, loadingOlder]);

  const handleSend = async () => {
    const text = draft.trim();

    if (!text && attachedFiles.length === 0) {
      return;
    }

    setSending(true);
    try {
      const res = await api.onlineChat.send({
        body: text,
        attachments: attachedFiles,
      });

      if (!res.success) {
        toast({ variant: "destructive", title: t("common.error"), description: res.message || t("supportChatRoom.toast.sendFailed") });
        return;
      }

      shouldScrollToBottomRef.current = true;
      syncConversationDetails(res.data, { preserveOlderMessages: true });
      setDraft("");
      setAttachedFiles([]);
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("supportChatRoom.toast.sendConnectionFailed") });
    } finally {
      setSending(false);
    }
  };

  const appendEmoji = (emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
    setEmojiPickerOpen(false);
  };

  const handleAttachFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    setAttachedFiles((current) => {
      const remainingSlots = MAX_CHAT_ATTACHMENTS - current.length;

      if (remainingSlots <= 0) {
        toast({ variant: "destructive", title: t("supportChatRoom.toast.maxImagesTitle"), description: t("supportChatRoom.toast.maxImagesDescription", { count: format.number(MAX_CHAT_ATTACHMENTS) }) });
        return current;
      }

      const validFiles = selectedFiles.filter((file) => {
        if (!isAllowedChatAttachment(file)) {
          toast({ variant: "destructive", title: t("supportChatRoom.toast.invalidFileTypeTitle"), description: t("supportChatRoom.toast.invalidFileTypeDescription") });
          return false;
        }

        if (file.size > MAX_CHAT_ATTACHMENT_SIZE) {
          toast({ variant: "destructive", title: t("supportChatRoom.toast.fileTooLargeTitle"), description: t("supportChatRoom.toast.fileTooLargeDescription", { size: t("panelOnlineChat.units.megabyte", { value: format.number(10) }) }) });
          return false;
        }

        return true;
      });

      if (validFiles.length > remainingSlots) {
        toast({ variant: "destructive", title: t("supportChatRoom.toast.maxImagesTitle"), description: t("supportChatRoom.toast.maxImagesDescription", { count: format.number(MAX_CHAT_ATTACHMENTS) }) });
      }

      return [...current, ...validFiles.slice(0, remainingSlots)];
    });
    event.target.value = "";
  };

  const removeAttachedFile = (fileIndex: number) => {
    setAttachedFiles((current) => current.filter((_, index) => index !== fileIndex));
  };

  if (isLoading || (isAuthenticated && !metaReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f] text-white" dir={dir}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f] px-4 text-white" dir={dir}>
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-400/15 text-emerald-300">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="mt-5 text-xl font-black">{t("supportChatRoom.auth.title")}</div>
          <p className="mt-3 leading-7 text-slate-400">{t("supportChatRoom.auth.description")}</p>
          <div className="mt-5 flex flex-col gap-3">
            <Button onClick={() => setLoginOpen(true)} className="h-12 rounded-full bg-emerald-400 px-6 font-black text-slate-950 hover:bg-emerald-300">
              {t("supportChatRoom.auth.login")}
            </Button>
            <Link href="/">
              <Button variant="outline" className="h-12 rounded-full border-white/10 bg-white/5 px-6 text-slate-100 hover:bg-white/10 hover:text-white">
                {t("common.back")}
              </Button>
            </Link>
          </div>
        </div>
        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          phoneStepDescription={t("supportChatRoom.auth.phoneStepDescription")}
        />
      </div>
    );
  }

  if (!moduleActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f] px-4 text-white" dir={dir}>
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-xl font-black">{t("supportChatRoom.inactive.title")}</div>
          <p className="mt-3 leading-7 text-slate-400">{t("supportChatRoom.inactive.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#07131f] px-4 py-8 pb-72 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_24%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.1),transparent_26%),linear-gradient(180deg,rgba(7,19,31,0.98),rgba(5,11,18,1))]" />
      <div className="fixed end-[-14%] top-16 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="fixed bottom-24 start-[-18%] -z-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl pb-28">
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-black text-white md:text-3xl">{t("supportChatRoom.header.title")}</div>
            <div className="text-sm text-slate-400">{t("supportChatRoom.header.description")}</div>
          </div>
          <Link href="/">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-slate-200"
            >
              <ArrowLeft className={`h-4.5 w-4.5 ${isRtl ? "" : "rotate-180"}`} />
            </button>
          </Link>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,22,35,0.98),rgba(7,16,27,0.96))] shadow-[0_40px_100px_-55px_rgba(0,0,0,0.98)]">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(14,33,48,0.98),rgba(8,18,30,0.96))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-emerald-400/15 text-emerald-300">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <span className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full border-2 border-[#0e2235] bg-emerald-400" />
                </div>

                <div>
                  <div className="text-lg font-black text-white">{t("supportChatRoom.header.title")}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isConversationClosed ? t("supportChatRoom.status.closed") : t("supportChatRoom.status.ready")}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div ref={messagesRef} className="pretty-scrollbar space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_34%)] p-4 pb-32 max-h-[calc(100vh-250px)]">
            {showIntroNotice ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-bold text-slate-400">{t("supportChatRoom.intro.title")}</div>
                  <button
                    type="button"
                    onClick={() => setShowIntroNotice(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400"
                    title={t("common.close")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-sm leading-7 text-slate-300">
                  {t("supportChatRoom.intro.description")}
                </div>
              </div>
            ) : null}

            {isConversationClosed ? (
              <div className="rounded-[24px] border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-sm leading-7 text-amber-100">
                {t("supportChatRoom.closedNotice")}
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : orderedMessages.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm leading-7 text-slate-400">
                {t("supportChatRoom.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {loadingOlder ? (
                  <div className="flex items-center justify-center py-2 text-xs text-slate-400">
                    <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                    {t("panelOnlineChat.messages.loadingOlder")}
                  </div>
                ) : null}
                {orderedMessages.map((message, index) => {
                  const previousMessage = orderedMessages[index - 1];
                  const showDateDivider =
                    index === 0 ||
                    formatMessageDay(previousMessage?.createdAt, format) !== formatMessageDay(message.createdAt, format);

                  return (
                    <div key={message.id} className="space-y-3">
                      {showDateDivider ? (
                        <div className="flex justify-center">
                          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] font-bold text-slate-300">
                            {formatMessageDay(message.createdAt, format)}
                          </div>
                        </div>
                      ) : null}

                      <div className={`flex ${message.senderType === "customer" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[88%] rounded-[30px] border px-4 py-3 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.95)] ${message.senderType === "customer" ? "rounded-br-[12px] border-cyan-300/15 bg-cyan-400/12" : "rounded-bl-[12px] border-emerald-300/15 bg-emerald-400/12"}`}>
                          <div className="mb-2 flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-[12px] ${message.senderType === "customer" ? "bg-cyan-300 text-slate-950" : "bg-emerald-300 text-slate-950"}`}>
                              {message.senderType === "customer" ? <UserRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            </div>
                            <div className="text-xs font-black text-white">
                              {message.senderType === "customer" ? (user?.name?.trim() || t("supportChatRoom.messages.you")) : (message.senderName || t("panelOnlineChat.messages.supportAgent"))}
                            </div>
                          </div>

                          {message.body ? <div className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-100">{message.body}</div> : null}

                          {message.attachments.length > 0 ? (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {message.attachments.map((attachment) => (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  onClick={() => setPreviewImage({ url: attachment.url, name: attachment.originalName })}
                                  className="overflow-hidden rounded-[18px] border border-white/10 bg-black/15 text-start"
                                >
                                  {isImageMimeType(attachment.mimeType) ? (
                                    <img src={attachment.url} alt={attachment.originalName} className="h-28 w-full object-cover" />
                                  ) : null}
                                  <div className="p-2">
                                    <div className="truncate text-xs font-bold text-white">{attachment.originalName}</div>
                                    <div className="mt-1 text-[11px] text-slate-400">{attachmentSizeLabel(attachment.size, format, t)}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-400">
                            <span>{formatMessageTime(message.createdAt, format)}</span>
                            {message.senderType === "customer" ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div aria-hidden="true" className="h-16" />
          </div>
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,rgba(7,19,31,0),rgba(7,19,31,0.78)_24%,rgba(7,19,31,0.98)_54%,rgba(7,19,31,1))] px-4 pb-4 pt-12">
          <div className="pointer-events-auto mx-auto max-w-3xl">
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,24,37,0.98),rgba(7,16,27,1))] p-3 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.98)] backdrop-blur-xl">
              <div className="rounded-[24px] border border-white/10 bg-black/15 p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAttachFiles}
                />

                {attachedFiles.length > 0 ? (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {attachedFilePreviews.map(({ file, url }, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative overflow-hidden rounded-[18px] border border-white/10 bg-white/5"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ url, name: file.name })}
                          className="block w-full text-start"
                        >
                          <img src={url} alt={file.name} className="h-28 w-full object-cover" />
                          <div className="p-2">
                            <div className="truncate text-xs font-bold text-white">{file.name}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{attachmentSizeLabel(file.size, format, t)}</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(index)}
                          className="absolute start-2 top-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-400/15 bg-[#07131f]/80 text-red-200 backdrop-blur"
                          title={t("supportChatRoom.attachments.remove")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("supportChatRoom.composer.placeholder")}
                  className="min-h-[92px] resize-none border-0 bg-transparent px-2 text-base text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={attachedFiles.length >= MAX_CHAT_ATTACHMENTS}
                      className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/10 px-3 py-2 text-xs font-black text-slate-400 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {t("supportChatRoom.composer.addPhoto")}
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setEmojiPickerOpen((current) => !current)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300"
                        title={t("supportChatRoom.composer.addEmoji")}
                      >
                        <SmilePlus className="h-4.5 w-4.5" />
                      </button>

                      {emojiPickerOpen ? (
                        <div className="absolute bottom-12 end-0 z-30 w-56 rounded-[22px] border border-white/10 bg-[#0d1c2b]/95 p-3 shadow-[0_30px_70px_-35px_rgba(0,0,0,0.98)] backdrop-blur-xl">
                          <div className="mb-2 text-start text-[11px] font-bold text-slate-400">{t("supportChatRoom.composer.emojiPicker")}</div>
                          <div className="grid grid-cols-5 gap-2">
                            {quickEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => appendEmoji(emoji)}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-base transition hover:bg-white/10"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden text-[11px] text-slate-500 md:block">
                      {t("supportChatRoom.composer.photoHint")}
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending || (!draft.trim() && attachedFiles.length === 0)}
                      className="h-12 rounded-full bg-emerald-400 px-5 text-sm font-black text-slate-950 hover:bg-emerald-300"
                    >
                      {sending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="me-2 h-4 w-4" />}
                      {t("supportChatRoom.composer.send")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute start-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#07131f]/80 text-white"
              title={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07131f]">
              <img src={previewImage.url} alt={previewImage.name} className="max-h-[80vh] w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
