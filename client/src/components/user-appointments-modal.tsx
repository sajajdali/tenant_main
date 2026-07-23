import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PaginatedAppointments, TenantMeta, TenantPanelUser } from "@/lib/types";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { CalendarDays, Clock, Loader2, ReceiptText, User } from "lucide-react";
import { LtrText, PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

interface UserAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: TenantPanelUser | null;
  barberId: string;
}

export function UserAppointmentsModal({ isOpen, onClose, user, barberId }: UserAppointmentsModalProps) {
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const t = useT();
  const format = useFormat();
  const { dir } = useLocale();
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaginatedAppointments>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });

  const loadAppointments = async (nextScope = scope, nextPage = 1) => {
    if (!user || !barberId) return;
    setLoading(true);
    const res = await api.users.appointments(user.mobile, barberId, nextScope, nextPage, 10);
    if (res.success) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen || !user || !barberId) return;
    loadAppointments(scope, 1);
  }, [isOpen, user?.mobile, barberId, scope]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0 text-start" dir={dir}>
        <div className="flex max-h-[85vh] flex-col text-start">
          <div className="space-y-4 border-b border-border/60 px-6 pb-4 pt-6">
            <DialogHeader className="text-start sm:text-start">
              <DialogTitle>{t("userAppointments.title")}</DialogTitle>
              <DialogDescription>
                {user
                  ? t("userAppointments.description", { name: user.fullName || user.mobile })
                  : t("userAppointments.selectUser")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {user ? (
                  <>
                    <span className="font-medium text-foreground">{user.fullName || t("userAppointments.noName")}</span>
                    <span className="mx-2">•</span>
                    <PhoneText>{user.mobile}</PhoneText>
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant={scope === "upcoming" ? "default" : "outline"} onClick={() => setScope("upcoming")}>
                  {t("userAppointments.scope.upcoming")}
                </Button>
                <Button variant={scope === "past" ? "default" : "outline"} onClick={() => setScope("past")}>
                  {t("userAppointments.scope.past")}
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center px-6 text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : data.items.length === 0 ? (
            <div className="px-6 py-6">
              <div className="rounded-2xl border border-dashed bg-card/30 p-8 text-center text-muted-foreground">
                {t("userAppointments.empty")}
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 px-6 py-5">
                <div className="space-y-3 pb-2">
                  {data.items.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card/95 to-card/70 p-4 text-start shadow-sm transition-colors hover:border-primary/30"
                    >
                      <div className="space-y-4 text-start">
                        <div className="flex flex-wrap items-start justify-between gap-3 text-start">
                          <div className="space-y-1 text-start">
                            <div className="font-bold">{appointment.barberName || labels.singular}</div>
                            <div className="text-sm text-muted-foreground">{appointment.sectionName || t("userAppointments.serviceFallback")}</div>
                          </div>
                          <Badge variant={appointment.status === "cancelled" ? "secondary" : "outline"}>
                            {appointment.status === "cancelled"
                              ? t("userAppointments.status.cancelled")
                              : scope === "upcoming"
                                ? t("userAppointments.status.upcoming")
                                : t("userAppointments.status.past")}
                          </Badge>
                        </div>

                        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                          <div className="flex items-center justify-end gap-2 text-start">
                            <span>{format.date(appointment.date)}</span>
                            <CalendarDays className="h-4 w-4 shrink-0" />
                          </div>
                          <div className="flex items-center justify-end gap-2 text-start">
                            <span>
                              <LtrText>{appointment.startTime}</LtrText> {t("userAppointments.timeTo")} <LtrText>{appointment.endTime}</LtrText>
                            </span>
                            <Clock className="h-4 w-4 shrink-0" />
                          </div>
                          <div className="flex items-center justify-end gap-2 text-start">
                            <span>{appointment.userName}</span>
                            <User className="h-4 w-4 shrink-0" />
                          </div>
                        </div>

                        {appointment.isForSomeoneElse && (
                          <div className="rounded-lg bg-muted/40 p-3 text-start text-sm text-muted-foreground">
                            {t("userAppointments.forSomeoneElse")}
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button asChild variant="outline" size="sm" className="rounded-2xl">
                            <a href={`/panel/manual-finance?appointment_id=${encodeURIComponent(appointment.id)}`}>
                              <ReceiptText className="me-2 h-4 w-4" />
                              {t("userAppointments.addExpense")}
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>

              <div className="flex flex-col gap-4 border-t border-border/60 bg-background/95 px-6 py-4 text-start backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("userAppointments.total", { count: format.number(data.total) })}
                </div>
                <Pagination className="mx-0 w-auto justify-start">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (data.currentPage > 1) {
                            loadAppointments(scope, data.currentPage - 1);
                          }
                        }}
                        className={data.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {t("userAppointments.page", {
                          current: format.number(data.currentPage),
                          total: format.number(data.lastPage),
                        })}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (data.currentPage < data.lastPage) {
                            loadAppointments(scope, data.currentPage + 1);
                          }
                        }}
                        className={data.currentPage >= data.lastPage ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
