import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeHelp,
  ImagePlus,
  Loader2,
  MessagesSquare,
  ShieldAlert,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { subscribeSupportTicketUpdates } from "@/lib/realtime";
import type { PaginatedSupportTickets, SupportTicket, SupportTicketDetails } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import type { TenantMeta } from "@/lib/types";
import { SupportExpiredLock } from "@/components/support-expired-lock";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const STATUS_LABELS = {
  waiting_admin: "supportTickets.status.waitingAdmin",
  waiting_requester: "supportTickets.status.waitingRequester",
  closed: "supportTickets.status.closed",
} as const;

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive"> = {
  waiting_admin: "secondary",
  waiting_requester: "default",
  closed: "destructive",
};

function buildFilePreview(file: File) {
  return {
    file,
    url: URL.createObjectURL(file),
  };
}

function resolveAttachmentUrl(url: string) {
  if (!url) return url;

  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }

  try {
    const parsed = new URL(url);
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function buildAttachmentPath(attachment: { id: string; url: string }) {
  if (attachment.url) {
    return resolveAttachmentUrl(attachment.url);
  }

  if (attachment.id) {
    return `${window.location.origin}/support-attachments/${attachment.id}`;
  }

  return "";
}

export default function PanelSupportPage() {
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const { toast } = useToast();
  const { dir, isRtl } = useLocale();
  const t = useT();
  const format = useFormat();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Array<{ file: File; url: string }>>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [replyAttachmentPreviews, setReplyAttachmentPreviews] = useState<Array<{ file: File; url: string }>>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; title?: string } | null>(null);
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const [data, setData] = useState<PaginatedSupportTickets>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
    stats: {
      total: 0,
      open: 0,
      answered: 0,
      closed: 0,
      unread: 0,
    },
  });

  const labels = getAudienceLabels(tenantMeta);
  const formatTicketDate = (date?: string | null) => (date ? format.dateTime(date) : t("supportTickets.notSet"));
  const getStatusLabel = (status: string) => {
    const key = STATUS_LABELS[status as keyof typeof STATUS_LABELS];
    return key ? t(key) : status;
  };

  const loadTickets = async (page = 1) => {
    setLoading(true);
    const res = await api.supportTickets.list(page, 10);
    if (res.success) {
      setData(res.data);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setLoading(false);
  };

  const refreshSelectedTicket = async (ticketId: string) => {
    const res = await api.supportTickets.details(ticketId);

    if (res.success) {
      setSelectedTicket(res.data);
    }
  };

  useEffect(() => {
    if (!isPrimaryAdmin) {
      if (typeof window !== "undefined") {
        window.location.replace("/panel");
      }
      return;
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });

    if (isPrimaryAdmin) {
      loadTickets(1);
    }
  }, [isPrimaryAdmin]);

  useEffect(() => {
    if (!isPrimaryAdmin) {
      return;
    }

    return subscribeSupportTicketUpdates(() => {
      loadTickets(data.currentPage);

      if (selectedTicket?.ticket.id) {
        refreshSelectedTicket(selectedTicket.ticket.id);
      }
    });
  }, [isPrimaryAdmin, data.currentPage, selectedTicket?.ticket.id]);

  useEffect(() => {
    return () => {
      attachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
      replyAttachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [attachmentPreviews, replyAttachmentPreviews]);

  const unreadCount = useMemo(() => data.stats.unread, [data.stats.unread]);

  if (!isPrimaryAdmin) {
    return null;
  }

  if (tenantMeta?.supportExpired) {
    return <SupportExpiredLock businessLabel={labels.business} isAdmin={isAdmin} />;
  }

  const openDetails = async (ticket: SupportTicket) => {
    setDetailsLoading(true);
    const res = await api.supportTickets.details(ticket.id);
    if (res.success) {
      setSelectedTicket(res.data);
      setReplyBody("");
      setReplyAttachments([]);
      loadTickets(data.currentPage);
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
    }
    setDetailsLoading(false);
  };

  const handleCreate = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ variant: "destructive", title: t("common.error"), description: t("supportTickets.validation.completeTicket") });
      return;
    }

    setCreating(true);
    const res = await api.supportTickets.create({ subject, body, attachments });
    setCreating(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("supportTickets.toast.createdTitle"), description: res.message });
    setSubject("");
    setBody("");
    setAttachments([]);
    attachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    setAttachmentPreviews([]);
    await loadTickets(1);
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyBody.trim()) {
      return;
    }

    setReplying(true);
    const res = await api.supportTickets.reply(selectedTicket.ticket.id, {
      body: replyBody,
      attachments: replyAttachments,
    });
    setReplying(false);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("supportTickets.toast.replyCreatedTitle"), description: res.message });
    setSelectedTicket(res.data);
    setReplyBody("");
    setReplyAttachments([]);
    replyAttachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    setReplyAttachmentPreviews([]);
    loadTickets(data.currentPage);
  };

  const handleClose = async (ticket: SupportTicket) => {
    setClosing(ticket.id);
    const res = await api.supportTickets.close(ticket.id);
    setClosing(null);

    if (!res.success) {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return;
    }

    toast({ title: t("supportTickets.toast.closedTitle"), description: res.message });
    loadTickets(data.currentPage);

    if (selectedTicket?.ticket.id === ticket.id) {
      setSelectedTicket((current) => current ? { ...current, ticket: { ...current.ticket, ...res.data } } : current);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20" dir={dir}>
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("supportTickets.title")}</h1>
          </div>
          <Link href="/panel">
            <Button
              variant="outline"
              size="icon"
              title={t("supportTickets.back")}
              className="h-10 w-10 rounded-2xl border-border bg-background/40 hover:bg-background/70"
            >
              <ArrowRight className={`w-5 h-5 ${isRtl ? "" : "rotate-180"}`} />
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="border-border/70 bg-card/50"><CardContent className="p-4 text-center"><div className="text-sm text-muted-foreground">{t("supportTickets.stats.total")}</div><div className="mt-2 text-2xl font-bold text-primary">{format.number(data.stats.total)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/50"><CardContent className="p-4 text-center"><div className="text-sm text-muted-foreground">{t("supportTickets.stats.open")}</div><div className="mt-2 text-2xl font-bold">{format.number(data.stats.open)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/50"><CardContent className="p-4 text-center"><div className="text-sm text-muted-foreground">{t("supportTickets.stats.answered")}</div><div className="mt-2 text-2xl font-bold">{format.number(data.stats.answered)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/50"><CardContent className="p-4 text-center"><div className="text-sm text-muted-foreground">{t("supportTickets.stats.closed")}</div><div className="mt-2 text-2xl font-bold">{format.number(data.stats.closed)}</div></CardContent></Card>
          <Card className="border-border/70 bg-card/50"><CardContent className="p-4 text-center"><div className="text-sm text-muted-foreground">{t("supportTickets.stats.unread")}</div><div className="mt-2 text-2xl font-bold text-primary">{format.number(unreadCount)}</div></CardContent></Card>
        </section>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("supportTickets.createTitle")}</CardTitle>
            <CardDescription>{t("supportTickets.createDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("supportTickets.subjectPlaceholder")} className="text-start" dir={dir} />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("supportTickets.bodyPlaceholder")} className="min-h-32 text-start" dir={dir} />
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <ImagePlus className="h-4 w-4" />
                {t("supportTickets.addImage")}
              </label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  attachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
                  const files = Array.from(event.target.files ?? []).slice(0, 5);
                  setAttachments(files);
                  setAttachmentPreviews(files.map(buildFilePreview));
                }}
              />
              {attachmentPreviews.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {attachmentPreviews.map((item) => (
                    <div key={item.url} className="relative">
                      <button
                        type="button"
                        className="absolute end-1 top-1 z-10 rounded-full bg-black/65 p-1 text-white"
                        aria-label={t("supportTickets.removeImage")}
                        onClick={() => {
                          URL.revokeObjectURL(item.url);
                          setAttachments((current) => current.filter((file) => file !== item.file));
                          setAttachmentPreviews((current) => current.filter((preview) => preview.file !== item.file));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setImagePreview({ url: item.url, title: item.file.name })}>
                        <img src={item.url} alt={item.file.name} className="h-20 w-20 rounded-xl border border-border/70 object-cover" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full sm:w-auto">
              {creating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeHelp className="me-2 h-4 w-4" />}
              {t("supportTickets.createButton")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">{t("supportTickets.listTitle")}</CardTitle>
            <CardDescription>{t("supportTickets.listDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="me-2 h-5 w-5 animate-spin" />{t("common.loading")}</div>
            ) : data.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/20 p-6 text-center text-sm text-muted-foreground">{t("supportTickets.empty")}</div>
            ) : (
              <>
                <div className="space-y-3">
                  {data.items.map((ticket) => (
                    <div key={ticket.id} className="rounded-2xl border border-border/70 bg-background/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2 text-start">
                          <div className="font-bold">{ticket.subject}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("supportTickets.lastUpdated", { date: formatTicketDate(ticket.lastMessageAt) })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.requesterUnreadCount > 0 && (
                            <Badge variant="default">{t("supportTickets.newReplies", { count: format.number(ticket.requesterUnreadCount) })}</Badge>
                          )}
                          <Badge variant={STATUS_VARIANTS[ticket.status] ?? "secondary"}>
                            {getStatusLabel(ticket.status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          {t("supportTickets.messageCount", { count: format.number(ticket.messagesCount) })}
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.status !== "closed" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleClose(ticket)}
                              disabled={closing === ticket.id}
                            >
                              {closing === ticket.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                              {t("supportTickets.closeTicket")}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openDetails(ticket)}>
                            {t("supportTickets.viewAndContinue")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {data.lastPage > 1 && (
                  <Pagination dir={dir}>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (data.currentPage > 1) loadTickets(data.currentPage - 1);
                          }}
                          className={data.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        >
                          {t("supportTickets.previousPage")}
                        </PaginationPrevious>
                      </PaginationItem>
                      <PaginationItem className="px-3 text-sm text-muted-foreground">
                        {t("supportTickets.pageOf", { page: format.number(data.currentPage), total: format.number(data.lastPage) })}
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (data.currentPage < data.lastPage) loadTickets(data.currentPage + 1);
                          }}
                          className={data.currentPage === data.lastPage ? "pointer-events-none opacity-50" : ""}
                        >
                          {t("supportTickets.nextPage")}
                        </PaginationNext>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{selectedTicket?.ticket.subject}</DialogTitle>
          </DialogHeader>

          {detailsLoading || !selectedTicket ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="me-2 h-5 w-5 animate-spin" />{t("common.loading")}</div>
          ) : (
            <div className="space-y-4">
              <ScrollArea className="h-[420px] rounded-2xl border border-border/70 bg-background/20">
                <div className="space-y-3 p-4">
                  {selectedTicket.messages.map((message) => {
                    const isSupport = message.senderType === "central_admin";
                    return (
                      <div key={message.id} className={`flex ${isSupport ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[85%] rounded-2xl border p-4 ${isSupport ? "border-primary/20 bg-primary/10" : "border-border/70 bg-card/60"}`}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{message.senderName || (isSupport ? t("supportTickets.sender.support") : t("supportTickets.sender.you"))}</span>
                            <span>{formatTicketDate(message.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-7 text-sm">{message.body}</p>
                          {message.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-3">
                              {message.attachments.map((attachment) => (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  className="group relative"
                                  onClick={() => setImagePreview({ url: buildAttachmentPath(attachment), title: attachment.originalName })}
                                >
                                  <img
                                    src={buildAttachmentPath(attachment)}
                                    alt={attachment.originalName}
                                    className="h-24 w-24 rounded-xl border border-border/70 object-cover"
                                  />
                                  <span className="absolute inset-x-1 bottom-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    {attachment.originalName}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {selectedTicket.ticket.status !== "closed" && (
                <Card className="border-border/70 bg-card/50">
                  <CardContent className="space-y-4 p-4">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={t("supportTickets.replyPlaceholder")}
                      className="min-h-28 text-start"
                      dir={dir}
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        replyAttachmentPreviews.forEach((item) => URL.revokeObjectURL(item.url));
                        const files = Array.from(event.target.files ?? []).slice(0, 5);
                        setReplyAttachments(files);
                        setReplyAttachmentPreviews(files.map(buildFilePreview));
                      }}
                    />
                    {replyAttachmentPreviews.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {replyAttachmentPreviews.map((item) => (
                          <div key={item.url} className="relative">
                            <button
                              type="button"
                              className="absolute end-1 top-1 z-10 rounded-full bg-black/65 p-1 text-white"
                              aria-label={t("supportTickets.removeImage")}
                              onClick={() => {
                                URL.revokeObjectURL(item.url);
                                setReplyAttachments((current) => current.filter((file) => file !== item.file));
                                setReplyAttachmentPreviews((current) => current.filter((preview) => preview.file !== item.file));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => setImagePreview({ url: item.url, title: item.file.name })}>
                              <img src={item.url} alt={item.file.name} className="h-20 w-20 rounded-xl border border-border/70 object-cover" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="destructive" onClick={() => handleClose(selectedTicket.ticket)}>
                        {t("supportTickets.closeTicket")}
                      </Button>
                      <Button onClick={handleReply} disabled={replying || !replyBody.trim()}>
                        {replying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <MessagesSquare className="me-2 h-4 w-4" />}
                        {t("supportTickets.replyButton")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!imagePreview} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="max-w-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{imagePreview?.title || t("supportTickets.imagePreviewTitle")}</DialogTitle>
          </DialogHeader>
          {imagePreview && (
            <div className="flex justify-center">
              <img
                src={imagePreview.url}
                alt={imagePreview.title || t("supportTickets.imagePreviewAlt")}
                className="max-h-[75vh] w-auto rounded-2xl border border-border/70 object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
