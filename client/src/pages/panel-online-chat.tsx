import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCheck,
  Filter,
  Loader2,
  MessageCircleMore,
  Paperclip,
  PhoneCall,
  Search,
  SendHorizonal,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { getAudienceLabels } from "@/lib/audience";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { subscribeOnlineChatAdminUpdates } from "@/lib/realtime";
import { useToast } from "@/hooks/use-toast";
import type { OnlineChatConversationDetails, OnlineChatConversationSummary, OnlineChatMessage, TenantMeta } from "@/lib/types";
import { playChatNotificationSound } from "@/lib/chat-notification-sound";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { PhoneText } from "@/i18n/ltr-text";
import type { MessageKey } from "@/i18n/messages";

function initials(name?: string | null, mobile?: string | null) {
  const safeName = name?.trim();

  if (safeName) {
    return safeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("");
  }

  return mobile?.slice(-2) ?? "?";
}

function statusUi(thread: OnlineChatConversationSummary, t: (key: MessageKey) => string) {
  if (thread.customer?.isVip) {
    return {
      label: t("panelOnlineChat.status.vip"),
      className: "border-amber-300/25 bg-amber-300/10 text-amber-200",
      dotClassName: "bg-amber-300",
    };
  }

  if (thread.status === "closed") {
    return {
      label: t("panelOnlineChat.status.closed"),
      className: "border-white/10 bg-white/5 text-slate-300",
      dotClassName: "bg-slate-400",
    };
  }

  if (thread.adminUnreadCount > 0) {
    return {
      label: t("panelOnlineChat.status.newMessage"),
      className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
      dotClassName: "bg-emerald-300",
    };
  }

  return {
    label: t("panelOnlineChat.status.active"),
    className: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    dotClassName: "bg-cyan-300",
  };
}

function isImageMimeType(mimeType?: string | null) {
  return String(mimeType ?? "").toLowerCase().startsWith("image/");
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

export default function PanelOnlineChatPage() {
  const { isAdmin, isBarber } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const { dir, isRtl } = useLocale();
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState<OnlineChatConversationSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [selectedThreadDetails, setSelectedThreadDetails] = useState<OnlineChatConversationDetails | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [chatSettings, setChatSettings] = useState({
    moduleActive: false,
    showOnBookingPage: false,
    showInMenu: false,
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const firstRealtimeEventSkippedRef = useRef(false);
  const shouldScrollToBottomRef = useRef(false);
  const prependScrollStateRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(null);
  const initialConversationId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("conversation") ?? "";
  }, []);

  const labels = getAudienceLabels(tenantMeta);
  const supportExpired = tenantMeta?.supportExpired ?? false;
  const moduleActive = tenantMeta?.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false;
  const metaReady = Array.isArray(tenantMeta?.activeFeatureModules);
  const totalUnread = useMemo(() => threads.reduce((sum, item) => sum + item.adminUnreadCount, 0), [threads]);
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? selectedThreadDetails?.conversation ?? null,
    [selectedThreadDetails?.conversation, selectedThreadId, threads],
  );
  const attachmentPreviews = useMemo(
    () => attachments.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [attachments],
  );
  const formatChatTime = (value?: string | null) => format.time(value, { hour: "2-digit", minute: "2-digit" });
  const formatChatDateTime = (value?: string | null) => format.dateTime(value, {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const attachmentSizeLabel = (size: number) => size >= 1024 * 1024
    ? t("panelOnlineChat.units.megabyte", { value: format.number(Number((size / (1024 * 1024)).toFixed(1)) ) })
    : t("panelOnlineChat.units.kilobyte", { value: format.number(Math.max(1, Math.round(size / 1024))) });

  useEffect(() => {
    return () => {
      attachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [attachmentPreviews]);

  const loadMeta = async () => {
    const res = await api.meta.get();

    if (res.success) {
      setTenantMeta(res.data);
      setChatSettings(res.data.onlineChatSettings ?? {
        moduleActive: res.data.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false,
        showOnBookingPage: res.data.activeFeatureModules?.some((item) => item.slug === "online-chat") ?? false,
        showInMenu: false,
      });
    }
  };

  const loadSettings = async () => {
    setLoadingSettings(true);
    const res = await api.onlineChat.settings();
    setLoadingSettings(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.settingsLoadFailed") });
      return;
    }

    setChatSettings(res.data);
  };

  const loadThreads = async (searchValue = search, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingList(true);
    }

    const res = await api.onlineChat.adminList(searchValue);

    if (!options?.silent) {
      setLoadingList(false);
    }

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.listLoadFailed") });
      return;
    }

    setThreads(res.data.items);
    setSelectedThreadId((current) => {
      if (current && res.data.items.some((item) => item.id === current)) {
        return current;
      }

      if (initialConversationId && res.data.items.some((item) => item.id === initialConversationId)) {
        return initialConversationId;
      }

      return res.data.items[0]?.id ?? "";
    });
  };

  const syncThreadDetails = (
    incoming: OnlineChatConversationDetails,
    options?: { appendOlder?: boolean; preserveOlderMessages?: boolean },
  ) => {
    setSelectedThreadDetails((current) => {
      if (options?.appendOlder) {
        return {
          conversation: incoming.conversation,
          messages: mergeMessages(incoming.messages, current?.messages ?? []),
          messagesMeta: incoming.messagesMeta,
        };
      }

      const mergedMessages = options?.preserveOlderMessages
        ? mergeMessages(current?.messages ?? [], incoming.messages)
        : sortMessagesAsc(incoming.messages);

      const hasPreservedOlderMessages = (current?.messages.length ?? 0) > incoming.messages.length;

      return {
        conversation: incoming.conversation,
        messages: mergedMessages,
        messagesMeta: options?.preserveOlderMessages && hasPreservedOlderMessages
          ? current?.messagesMeta ?? incoming.messagesMeta
          : incoming.messagesMeta,
      };
    });
  };

  const loadThreadDetails = async (
    conversationId: string,
    options?: { silent?: boolean; beforeMessageId?: string | null; appendOlder?: boolean; preserveOlderMessages?: boolean },
  ) => {
    if (!conversationId) {
      setSelectedThreadDetails(null);
      return;
    }

    if (!options?.silent) {
      if (options?.appendOlder) {
        setLoadingOlderMessages(true);
      } else {
        setLoadingDetails(true);
      }
    }

    const res = await api.onlineChat.adminDetails(conversationId, options?.beforeMessageId);

    if (!options?.silent) {
      if (options?.appendOlder) {
        setLoadingOlderMessages(false);
      } else {
        setLoadingDetails(false);
      }
    }

    if (!res.success) {
      if (options?.appendOlder) {
        prependScrollStateRef.current = null;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.detailsLoadFailed") });
      return;
    }

    syncThreadDetails(res.data, {
      appendOlder: options?.appendOlder,
      preserveOlderMessages: options?.preserveOlderMessages,
    });
    setThreads((current) => current.map((item) => (
      item.id === conversationId && res.data.conversation
        ? { ...item, ...res.data.conversation }
        : item
    )));
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!moduleActive) {
      return;
    }

    if (!settingsOpen) {
      return;
    }

    void loadSettings();
  }, [moduleActive, settingsOpen]);

  useEffect(() => {
    if (!metaReady || !moduleActive) {
      return;
    }

    void loadThreads(search);
  }, [metaReady, moduleActive, search]);

  useEffect(() => {
    if (!selectedThreadId) {
      setSelectedThreadDetails(null);
      return;
    }

    if (!metaReady || !moduleActive) {
      return;
    }

    shouldScrollToBottomRef.current = true;
    void loadThreadDetails(selectedThreadId);
  }, [metaReady, moduleActive, selectedThreadId]);

  useEffect(() => {
    if (!metaReady || !moduleActive) {
      return;
    }

    return subscribeOnlineChatAdminUpdates((payload) => {
      const updatedId = String((payload.conversation as { id?: string })?.id ?? "");
      const action = payload.action;

      if (firstRealtimeEventSkippedRef.current) {
        if (action === "message_sent_by_customer") {
          void playChatNotificationSound();
        }
      } else {
        firstRealtimeEventSkippedRef.current = true;
      }

      void loadThreads(search, { silent: true });

      if (updatedId && updatedId === selectedThreadId) {
        shouldScrollToBottomRef.current = true;
        void loadThreadDetails(updatedId, { silent: true, preserveOlderMessages: true });
      }
    });
  }, [metaReady, moduleActive, search, selectedThreadId]);

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
      container.scrollTop = container.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [selectedThreadDetails?.messages]);

  useEffect(() => {
    const container = messagesRef.current;

    if (!container || !selectedThreadId) {
      return;
    }

    const handleScroll = () => {
      if (
        container.scrollTop > 80 ||
        loadingDetails ||
        loadingOlderMessages ||
        !selectedThreadDetails?.messagesMeta.hasOlder ||
        !selectedThreadDetails.messagesMeta.oldestMessageId
      ) {
        return;
      }

      prependScrollStateRef.current = {
        previousScrollHeight: container.scrollHeight,
        previousScrollTop: container.scrollTop,
      };

      void loadThreadDetails(selectedThreadId, {
        beforeMessageId: selectedThreadDetails.messagesMeta.oldestMessageId,
        appendOlder: true,
      });
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [loadingDetails, loadingOlderMessages, selectedThreadDetails?.messagesMeta.hasOlder, selectedThreadDetails?.messagesMeta.oldestMessageId, selectedThreadId]);

  const handleAttachments = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    setAttachments((current) => [...current, ...selectedFiles]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSend = async () => {
    if (!selectedThreadId || (draft.trim() === "" && attachments.length === 0)) {
      return;
    }

    setSending(true);
    const res = await api.onlineChat.adminSend(selectedThreadId, {
      body: draft,
      attachments,
    });
    setSending(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.sendFailed") });
      return;
    }

    setDraft("");
    setAttachments([]);
    shouldScrollToBottomRef.current = true;
    syncThreadDetails(res.data, { preserveOlderMessages: true });
    setThreads((current) => {
      const nextItem = res.data.conversation;

      if (!nextItem) {
        return current;
      }

      const filtered = current.filter((item) => item.id !== nextItem.id);
      return [nextItem, ...filtered];
    });
  };

  const handleConversationAction = async (mode: "close" | "reopen") => {
    if (!selectedThreadId) {
      return;
    }

    setActioning(true);
    const res = mode === "close"
      ? await api.onlineChat.adminClose(selectedThreadId)
      : await api.onlineChat.adminReopen(selectedThreadId);
    setActioning(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.actionFailed") });
      return;
    }

    toast({ title: t("panelOnlineChat.toast.done"), description: res.message });
    await loadThreads(search);
    await loadThreadDetails(selectedThreadId);
  };

  if (!isAdmin && !isBarber) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-md space-y-4 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">{t("panelOnlineChat.access.title")}</h1>
            <p className="leading-7 text-muted-foreground">{t("panelOnlineChat.access.description")}</p>
            <Link href="/panel">
              <Button>{t("panelOnlineChat.access.back")}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  if (!metaReady) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <Card className="w-full border-border/70 bg-card/70">
            <CardContent className="space-y-4 p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <div className="text-lg font-black">{t("panelOnlineChat.loading.module")}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!moduleActive) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground" dir={dir}>
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <Card className="w-full border-border/70 bg-card/70">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary/10 text-primary">
                <MessageCircleMore className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black">{t("panelOnlineChat.inactive.title")}</h1>
                <p className="leading-8 text-muted-foreground">
                  {t("panelOnlineChat.inactive.description")}
                </p>
              </div>
              <Link href="/panel/special-features/online-chat">
                <Button className="rounded-2xl px-6">{t("panelOnlineChat.inactive.cta")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-online-chat-page min-h-screen bg-[#08121f] text-white" dir={dir}>
      <header className="panel-online-chat-header sticky top-0 z-10 border-b border-white/10 bg-[#111d33]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 px-4 py-5 md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 text-start">
            <h1 className="text-2xl font-black text-white">{t("panelOnlineChat.header.title")}</h1>
            <p className="text-sm text-slate-400">{t("panelOnlineChat.header.description")}</p>
          </div>

          <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
            <Badge className="online-chat-unread-badge rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-emerald-200">
              {t("panelOnlineChat.header.unread", { count: format.number(totalUnread) })}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
            >
              <SlidersHorizontal className="me-2 h-4 w-4" />
              {t("panelOnlineChat.header.settings")}
            </Button>
            <Link href="/panel">
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10">
                <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] p-4 md:p-5">
        <div className={`flex flex-col gap-4 ${isRtl ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
          <aside className="w-full lg:w-[380px] xl:w-[420px]">
            <div className="online-chat-sidebar overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,24,38,0.98),rgba(8,17,29,0.96))] shadow-[0_40px_90px_-60px_rgba(0,0,0,0.95)]">
              <div className="online-chat-sidebar-header border-b border-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{t("panelOnlineChat.sidebar.title")}</div>
                    <div className="mt-1 text-xs text-slate-400">{t("panelOnlineChat.sidebar.description")}</div>
                  </div>
                  <button
                    type="button"
                    className="online-chat-filter-button flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-slate-300"
                  >
                    <Filter className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("panelOnlineChat.sidebar.searchPlaceholder")}
                    className="h-12 rounded-[18px] border-white/10 bg-white/5 ps-11 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="online-chat-thread-scroll pretty-scrollbar max-h-[calc(100vh-250px)] overflow-y-auto p-3 pe-2">
                {loadingList ? (
                  <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : threads.length === 0 ? (
                  <div className="online-chat-empty-state rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-center text-sm leading-7 text-slate-400">
                    {t("panelOnlineChat.sidebar.empty")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {threads.map((thread) => {
                      const status = statusUi(thread, t);
                      const selected = selectedThread?.id === thread.id;

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`online-chat-thread-item block w-full rounded-[26px] border p-3 text-start transition ${selected ? "online-chat-thread-item--selected border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="online-chat-avatar flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#12d6a5,#4cc9f0)] text-sm font-black text-slate-950">
                              {initials(thread.customer?.name, thread.customer?.mobile)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-black text-white">{thread.customer?.name?.trim() || t("panelOnlineChat.customer.unknownName")}</div>
                                  <div className="mt-1 truncate text-xs text-slate-400">
                                    {thread.customer?.mobile ? <PhoneText>{thread.customer.mobile}</PhoneText> : t("panelOnlineChat.customer.noMobile")}
                                  </div>
                                </div>
                                <div className="shrink-0 text-[11px] text-slate-500">{formatChatTime(thread.lastMessageAt || thread.createdAt)}</div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="truncate text-sm text-slate-300">{thread.lastMessagePreview || t("panelOnlineChat.messages.noPreview")}</div>
                                {thread.adminUnreadCount > 0 ? (
                                    <div className="online-chat-thread-unread inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-300 px-2 text-xs font-black text-slate-950">
                                    {format.number(thread.adminUnreadCount)}
                                  </div>
                                ) : null}
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${status.className}`}>
                                  <span className={`me-1 inline-flex h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
                                  {status.label}
                                </Badge>
                                <span className="text-[11px] text-slate-500">
                                  {thread.assignedTo?.name
                                    ? t("panelOnlineChat.thread.assignedTo", { name: thread.assignedTo.name })
                                    : t("panelOnlineChat.thread.unassigned")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="online-chat-conversation-shell overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,24,38,0.98),rgba(7,16,27,0.96))] shadow-[0_40px_100px_-60px_rgba(0,0,0,0.98)]">
              {selectedThread ? (
                <>
                  <div className="online-chat-conversation-header border-b border-white/10 bg-[linear-gradient(135deg,rgba(13,31,47,0.98),rgba(8,18,30,0.96))] p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="online-chat-avatar online-chat-avatar--large flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#12d6a5,#4cc9f0)] text-lg font-black text-slate-950">
                          {initials(selectedThread.customer?.name, selectedThread.customer?.mobile)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-black text-white">{selectedThread.customer?.name?.trim() || t("panelOnlineChat.customer.unknownName")}</div>
                            {selectedThread.customer?.isVip ? <Star className="h-4 w-4 text-amber-300" /> : null}
                          </div>
                          <div className="text-sm text-slate-400">
                            {selectedThread.customer?.mobile ? <PhoneText>{selectedThread.customer.mobile}</PhoneText> : t("panelOnlineChat.customer.noMobile")}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className={`inline-flex h-2 w-2 rounded-full ${statusUi(selectedThread, t).dotClassName}`} />
                            {statusUi(selectedThread, t).label}
                            <span className="text-slate-500">
                              {t("panelOnlineChat.conversation.lastUpdated", { date: formatChatDateTime(selectedThread.lastMessageAt || selectedThread.createdAt) })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end xl:self-auto">
                        <button
                          type="button"
                          className="online-chat-secondary-action flex h-11 items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-300"
                        >
                          <PhoneCall className="h-4 w-4" />
                          {t("panelOnlineChat.conversation.call")}
                        </button>
                        <Button
                          type="button"
                          onClick={() => void handleConversationAction(selectedThread.status === "closed" ? "reopen" : "close")}
                          disabled={actioning}
                          variant="outline"
                          className="online-chat-secondary-action h-11 rounded-[18px] border-white/10 bg-white/5 text-sm font-bold text-slate-300 hover:bg-white/10"
                        >
                          {actioning ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                          {selectedThread.status === "closed" ? t("panelOnlineChat.conversation.reopen") : t("panelOnlineChat.conversation.close")}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="online-chat-messages-area bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_34%)] p-4 md:p-5">
                    <div ref={messagesRef} className="online-chat-messages-scroll pretty-scrollbar max-h-[calc(100vh-360px)] space-y-3 overflow-y-auto pb-6 pe-2">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center py-16 text-slate-400">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : (selectedThreadDetails?.messages ?? []).length === 0 ? (
                        <div className="online-chat-empty-state rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
                          {t("panelOnlineChat.messages.empty")}
                        </div>
                      ) : (
                        <>
                          {loadingOlderMessages ? (
                            <div className="flex items-center justify-center py-2 text-xs text-slate-400">
                              <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                              {t("panelOnlineChat.messages.loadingOlder")}
                            </div>
                          ) : null}
                          {selectedThreadDetails?.messages.map((message) => (
                          <div key={message.id} className={`flex ${message.senderType === "panel_user" ? "justify-start" : "justify-end"}`}>
                            <div className={`online-chat-message-bubble max-w-[86%] rounded-[28px] border px-4 py-3 shadow-[0_24px_55px_-38px_rgba(0,0,0,0.95)] ${message.senderType === "panel_user" ? "online-chat-message-bubble--admin border-cyan-300/15 bg-cyan-400/12" : "online-chat-message-bubble--customer border-white/10 bg-white/[0.04]"}`}>
                              <div className="mb-2 flex items-center gap-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-[12px] ${message.senderType === "panel_user" ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-200"}`}>
                                  {message.senderType === "panel_user" ? <MessageCircleMore className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                                </div>
                                <div className="text-xs font-black text-white">
                                  {message.senderType === "panel_user"
                                    ? (message.senderName || t("panelOnlineChat.messages.supportAgent"))
                                    : (selectedThread.customer?.name || t("panelOnlineChat.messages.customer"))}
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
                                      className="online-chat-attachment overflow-hidden rounded-[18px] border border-white/10 bg-black/15 text-start"
                                    >
                                      {isImageMimeType(attachment.mimeType) ? (
                                        <img src={attachment.url} alt={attachment.originalName} className="h-28 w-full object-cover" />
                                      ) : null}
                                      <div className="p-2">
                                        <div className="truncate text-xs font-bold text-white">{attachment.originalName}</div>
                                        <div className="mt-1 text-[11px] text-slate-400">{attachmentSizeLabel(attachment.size)}</div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-400">
                                <span>{formatChatTime(message.createdAt)}</span>
                                {message.senderType === "panel_user" ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="online-chat-composer-wrap border-t border-white/10 bg-[linear-gradient(180deg,rgba(11,24,37,0.98),rgba(7,16,27,1))] p-4">
                    <div className="online-chat-composer rounded-[28px] border border-white/10 bg-black/15 p-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAttachments}
                      />

                      {attachments.length > 0 ? (
                        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {attachmentPreviews.map(({ file, url }, index) => (
                            <div key={`${file.name}-${index}`} className="online-chat-attachment-preview relative overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
                              <button type="button" onClick={() => setPreviewImage({ url, name: file.name })} className="block w-full text-start">
                                <img src={url} alt={file.name} className="h-24 w-full object-cover" />
                                <div className="p-2">
                                  <div className="truncate text-xs font-bold text-white">{file.name}</div>
                                  <div className="mt-1 text-[11px] text-slate-400">{attachmentSizeLabel(file.size)}</div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="absolute start-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#08121f]/85 text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={t("panelOnlineChat.composer.placeholder")}
                        className="min-h-[110px] resize-none border-0 bg-transparent px-2 text-base text-white shadow-none placeholder:text-slate-500 focus-visible:ring-0"
                      />

                      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="online-chat-attach-button inline-flex items-center gap-2 rounded-full border border-dashed border-white/10 px-3 py-2 font-black"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {t("panelOnlineChat.composer.attachPhoto")}
                          </button>
                          <span>{t("panelOnlineChat.composer.imageOnly")}</span>
                        </div>

                        <Button
                          type="button"
                          onClick={() => void handleSend()}
                          disabled={sending || (!draft.trim() && attachments.length === 0)}
                          className="online-chat-send-button h-12 rounded-full bg-emerald-400 px-6 text-sm font-black text-slate-950 hover:bg-emerald-300"
                        >
                          {sending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="me-2 h-4 w-4" />}
                          {t("panelOnlineChat.composer.send")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="online-chat-empty-conversation flex min-h-[70vh] items-center justify-center p-6 text-center">
                  <div className="max-w-md space-y-3">
                    <MessageCircleMore className="mx-auto h-12 w-12 text-cyan-300" />
                    <div className="text-xl font-black text-white">{t("panelOnlineChat.emptyConversation.title")}</div>
                    <div className="leading-8 text-slate-400">{t("panelOnlineChat.emptyConversation.description")}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute start-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#08121f]/85 text-white"
              title={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#08121f]">
              <img src={previewImage.url} alt={previewImage.name} className="max-h-[82vh] w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="online-chat-settings-dialog max-w-xl border-white/10 bg-[#0d1828] text-white sm:rounded-[28px]" dir={dir}>
          <DialogHeader className="text-start">
            <DialogTitle className="text-xl font-black text-white">{t("panelOnlineChat.settings.title")}</DialogTitle>
            <DialogDescription className="text-start text-slate-400">
              {t("panelOnlineChat.settings.description")}
            </DialogDescription>
          </DialogHeader>

          {loadingSettings ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="online-chat-settings-row rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 text-start">
                    <Label className="text-sm font-black text-white">{t("panelOnlineChat.settings.bookingPageLabel")}</Label>
                    <p className="text-xs leading-6 text-slate-400">
                      {t("panelOnlineChat.settings.bookingPageDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={chatSettings.showOnBookingPage}
                    onCheckedChange={(checked) => setChatSettings((current) => ({ ...current, showOnBookingPage: checked }))}
                  />
                </div>
              </div>

              <div className="online-chat-settings-row rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 text-start">
                    <Label className="text-sm font-black text-white">{t("panelOnlineChat.settings.menuLabel")}</Label>
                    <p className="text-xs leading-6 text-slate-400">
                      {t("panelOnlineChat.settings.menuDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={chatSettings.showInMenu}
                    onCheckedChange={(checked) => setChatSettings((current) => ({ ...current, showInMenu: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  {t("common.close")}
                </Button>
                <Button
                  type="button"
                  disabled={savingSettings}
                  onClick={async () => {
                    setSavingSettings(true);
                    const res = await api.onlineChat.updateSettings({
                      showOnBookingPage: chatSettings.showOnBookingPage,
                      showInMenu: chatSettings.showInMenu,
                    });
                    setSavingSettings(false);

                    if (!res.success) {
                      toast({ variant: "destructive", title: t("common.error"), description: res.message || t("panelOnlineChat.toast.settingsSaveFailed") });
                      return;
                    }

                    setChatSettings(res.data);
                    setTenantMeta((current) => current ? { ...current, onlineChatSettings: res.data } : current);
                    toast({ title: t("panelOnlineChat.toast.done"), description: res.message || t("panelOnlineChat.toast.settingsSaved") });
                    setSettingsOpen(false);
                  }}
                  className="rounded-2xl bg-emerald-400 px-5 text-slate-950 hover:bg-emerald-300"
                >
                  {savingSettings ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t("panelOnlineChat.settings.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
