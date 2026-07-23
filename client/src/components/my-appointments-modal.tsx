import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Appointment, PaginatedAppointments, TenantMeta } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { getAudienceLabels } from "@/lib/audience";
import { getInitialTenantMeta } from "@/lib/bootstrap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { CalendarDays, Clock, Loader2, User } from "lucide-react";
import { CancelModal } from "@/components/cancel-modal";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import { LtrText } from "@/i18n/ltr-text";

interface MyAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyAppointmentsModal({ isOpen, onClose }: MyAppointmentsModalProps) {
  const { user } = useAuth();
  const { dir } = useLocale();
  const t = useT();
  const format = useFormat();
  const [tenantMeta, setTenantMeta] = useState<TenantMeta | null>(() => getInitialTenantMeta());
  const labels = getAudienceLabels(tenantMeta);
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [loading, setLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [data, setData] = useState<PaginatedAppointments>({
    items: [],
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });

  const loadAppointments = async (nextScope = scope, nextPage = 1) => {
    setLoading(true);
    const res = await api.appointments.mine(nextScope, nextPage, 10);
    if (res.success) {
      setData(res.data);
    }
    setLoading(false);
  };

  const canCancelAppointment = (appointment: Appointment) => {
    if (appointment.status === "cancelled") return false;
    if (scope !== "upcoming") return false;
    if (appointment.cancellationLockedAt && nowMs >= new Date(appointment.cancellationLockedAt).getTime()) return false;
    return true;
  };

  const isCancellationLocked = (appointment: Appointment) =>
    appointment.status === "booked" &&
    scope === "upcoming" &&
    !!appointment.cancellationLockedAt &&
    nowMs >= new Date(appointment.cancellationLockedAt).getTime();

  useEffect(() => {
    if (!isOpen) return;
    loadAppointments(scope, 1);
  }, [isOpen, scope]);

  useEffect(() => {
    if (!isOpen) return;

    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    api.meta.get().then((res) => {
      if (res.success) {
        setTenantMeta(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (!cancelTarget) return;
    const stillExists = data.items.some((appointment) => appointment.id === cancelTarget.id);
    if (!stillExists) {
      setCancelTarget(null);
    }
  }, [cancelTarget, data.items]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0 text-start" dir={dir}>
        <div className="flex max-h-[85vh] flex-col text-start">
          <div className="space-y-4 border-b border-border/60 px-6 pb-4 pt-6">
            <DialogHeader className="text-start sm:text-start">
              <DialogTitle>{t("appointment.mine.title")}</DialogTitle>
              <DialogDescription>
                {t("appointment.mine.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap justify-start gap-2">
              <Button variant={scope === "upcoming" ? "default" : "outline"} onClick={() => setScope("upcoming")}>
                {t("appointment.mine.upcomingTab")}
              </Button>
              <Button variant={scope === "past" ? "default" : "outline"} onClick={() => setScope("past")}>
                {t("appointment.mine.pastTab")}
              </Button>
            </div>
          </div>

        {loading ? (
          <div className="flex h-52 items-center justify-center px-6 text-muted-foreground">
            <Loader2 className="me-2 h-5 w-5 animate-spin" />
            {t("appointment.mine.loading")}
          </div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-6">
            <div className="rounded-2xl border border-dashed bg-card/30 p-8 text-center text-muted-foreground">
            {t("appointment.mine.empty")}
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-3 pb-2">
              {data.items.map((appointment: Appointment) => {
                const registeredByAdminOrBarber =
                  appointment.bookedByRole === "admin" || appointment.bookedByRole === "barber";
                const cancellationLocked = isCancellationLocked(appointment);

                return (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card/95 to-card/70 p-4 text-start shadow-sm transition-colors hover:border-primary/30"
                >
                  <div className="space-y-4 text-start">
                  <div className="flex flex-wrap items-start justify-between gap-3 text-start">
                    <div className="space-y-1 text-start">
                      <div className="font-bold">{appointment.barberName || labels.singular}</div>
                      <div className="text-sm text-muted-foreground">{appointment.sectionName || t("appointment.mine.serviceFallback")}</div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <Badge variant={appointment.status === "cancelled" ? "secondary" : "outline"}>
                        {appointment.status === "cancelled"
                          ? t("appointment.mine.status.cancelled")
                          : scope === "upcoming"
                            ? t("appointment.mine.status.upcoming")
                            : t("appointment.mine.status.past")}
                      </Badge>
                      {canCancelAppointment(appointment) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => setCancelTarget(appointment)}
                        >
                          {t("appointment.mine.cancel")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {cancellationLocked && (
                    <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-start text-sm font-bold leading-7 text-amber-300">
                      {appointment.cancellationLockMessage || t("appointment.mine.cancelLockedDefault")}
                    </div>
                  )}

                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <div className="flex items-center justify-start gap-2 text-start">
                      <span>{format.date(appointment.date)}</span>
                      <CalendarDays className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="flex items-center justify-start gap-2 text-start">
                      <span>
                        <LtrText>{appointment.startTime}</LtrText> {t("appointment.mine.timeRangeSeparator")} <LtrText>{appointment.endTime}</LtrText>
                      </span>
                      <Clock className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="flex items-center justify-start gap-2 text-start">
                      <span>{appointment.userName}</span>
                      <User className="h-4 w-4 shrink-0" />
                    </div>
                  </div>

                  {appointment.isForSomeoneElse && (
                    <div className="rounded-lg bg-muted/40 p-3 text-start text-sm text-muted-foreground">
                      {t("appointment.mine.forSomeoneElse")}
                    </div>
                  )}
                  {registeredByAdminOrBarber && (
                    <div className="rounded-lg bg-primary/10 p-3 text-start text-sm text-primary">
                      {t("appointment.mine.registeredByAdmin")}
                    </div>
                  )}
                  </div>
                </div>
                );
              })}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>

            <div className="flex flex-col gap-4 border-t border-border/60 bg-background/95 px-6 py-4 text-start backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {t("appointment.mine.totalCount", { count: format.number(data.total) })}
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
                      {t("appointment.mine.pageOf", { page: format.number(data.currentPage), total: format.number(data.lastPage) })}
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
        <CancelModal
          isOpen={!!cancelTarget}
          onClose={async () => {
            setCancelTarget(null);
            if (user) {
              const res = await api.appointments.mine(scope, data.currentPage, 10);
              if (res.success) {
                setData(res.data);
              }
            }
          }}
          appointment={cancelTarget}
        />
      </DialogContent>
    </Dialog>
  );
}
