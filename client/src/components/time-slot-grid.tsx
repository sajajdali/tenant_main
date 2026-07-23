import { useMemo } from "react";
import { format, addMinutes, parse, isBefore, isAfter } from "date-fns";
import { Section, Appointment, Barber, ManualFinanceCustomerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getEffectiveSectionSchedule } from "@/lib/service-schedule";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Check, CheckCircle2, DollarSign, Lock, MessageSquareText, UserRoundPlus, UserRoundX, Users } from "lucide-react";
import { useFormat, useT } from "@/i18n/locale";

export interface TimeSlotItem {
  time: string;
  status: string;
  appointment?: Appointment;
  vipOnly?: boolean;
}

interface OffQueueItem {
  time: string;
  appointment: Appointment;
  type: "off_queue";
}

const getAttendanceBadge = (appointment: Appointment | undefined, t: ReturnType<typeof useT>) => {
  if (appointment?.status === "completed") {
    return {
      title: t("booking.timeSlots.attendance.completed"),
      className: "bg-emerald-400/12 text-emerald-300 ring-emerald-300/20",
      icon: "completed" as const,
    };
  }

  if (appointment?.status === "no_show") {
    return {
      title: t("booking.timeSlots.attendance.noShow"),
      className: "bg-rose-400/12 text-rose-300 ring-rose-300/20",
      icon: "no_show" as const,
    };
  }

  return null;
};

const breakAppliesToDate = (
  item: NonNullable<Section["vipBreaks"] | Section["restBreaks"]>[number],
  date?: string,
) => {
  const scope = item.scope ?? "all";

  if (scope === "weekdays") {
    if (!date) return false;

    const weekday = new Date(`${date}T12:00:00`).getDay();
    return (item.weekdays || []).map(Number).includes(weekday);
  }

  if (scope === "dates") {
    if (!date) return false;

    return (item.dates || []).includes(date);
  }

  return true;
};

export function buildTimeSlots(
  section: Section,
  appointments: Appointment[],
  date?: string,
  minimumBookableAt?: Date | null,
  blockedTimeRanges?: Barber["blockedTimeRanges"],
): TimeSlotItem[] {
  const generatedSlots: TimeSlotItem[] = [];
  
  const schedule = getEffectiveSectionSchedule(section, date);
  const start = parse(schedule.startHour, "HH:mm", new Date());
  const end = parse(schedule.endHour, "HH:mm", new Date());
  let current = start;

  while (isBefore(current, end)) {
    const timeStr = format(current, "HH:mm");
    const slotEnd = addMinutes(current, schedule.slotDurationMinutes);
    const slotDateTime =
      date ? new Date(`${date}T${timeStr}:00`) : null;

    const directBooking = appointments.find(
      (a) => a.sectionId === section.id && a.startTime === timeStr && !["cancelled"].includes(a.status),
    );

    const overlappingBooking = appointments.find((a) => {
      if (a.sectionId !== section.id || a.status === "cancelled") return false;

      const appStart = parse(a.startTime, "HH:mm", new Date());
      const appEnd = parse(a.endTime, "HH:mm", new Date());

      return isBefore(current, appEnd) && isAfter(slotEnd, appStart) && a.startTime !== timeStr;
    });

    const conflictBooking = section.checkConflicts
      ? appointments.find((a) => {
          if (a.sectionId === section.id || a.status === "cancelled") return false;
          const appStart = parse(a.startTime, "HH:mm", new Date());
          const appEnd = parse(a.endTime, "HH:mm", new Date());
          return isBefore(current, appEnd) && isAfter(slotEnd, appStart);
        })
      : undefined;

    const restBreak = section.restBreaks?.find((item) => {
      if (!breakAppliesToDate(item, date)) return false;

      const breakStart = parse(item.start, "HH:mm", new Date());
      const breakEnd = parse(item.end, "HH:mm", new Date());

      return isBefore(current, breakEnd) && isAfter(slotEnd, breakStart);
    });
    const vipBreak = section.vipBreaks?.find((item) => {
      if (!breakAppliesToDate(item, date)) return false;

      const breakStart = parse(item.start, "HH:mm", new Date());
      const breakEnd = parse(item.end, "HH:mm", new Date());

      return isBefore(current, breakEnd) && isAfter(slotEnd, breakStart);
    });
    const professionalBlock = blockedTimeRanges?.find((item) => {
      if (!date || item.date !== date) return false;

      const blockStart = parse(item.start, "HH:mm", new Date());
      const blockEnd = parse(item.end, "HH:mm", new Date());

      return isBefore(current, blockEnd) && isAfter(slotEnd, blockStart);
    });
    const quickBlockedSlot = section.quickBlockedSlots?.find((item) => {
      if (!date || item.date !== date) return false;

      const blockStart = parse(item.start, "HH:mm", new Date());
      const blockEnd = parse(item.end, "HH:mm", new Date());

      return isBefore(current, blockEnd) && isAfter(slotEnd, blockStart);
    });

    let status = "free";
    let relatedAppointment = undefined;

    if (directBooking) {
      status = directBooking.status === "pending_payment" ? "pending_payment" : "booked";
      relatedAppointment = directBooking;
    } else if (overlappingBooking) {
      status = overlappingBooking.status === "pending_payment" ? "pending_payment" : "overlapped";
      relatedAppointment = overlappingBooking;
    } else if (restBreak) {
      status = "break";
    } else if (quickBlockedSlot) {
      status = "quick_blocked";
    } else if (conflictBooking) {
      status = "conflict";
    } else if (professionalBlock) {
      status = "barber_blocked";
    } else if (minimumBookableAt && slotDateTime && slotDateTime < minimumBookableAt) {
      status = "lead_time_blocked";
    }

    generatedSlots.push({ time: timeStr, status, appointment: relatedAppointment, vipOnly: !!vipBreak });
    current = addMinutes(current, schedule.slotDurationMinutes);
  }

  return generatedSlots;
}

interface TimeSlotGridProps {
  section: Section;
  date: string;
  appointments: Appointment[]; // All appointments for the day (across all sections)
  minimumBookableAt?: Date | null;
  blockedTimeRanges?: Barber["blockedTimeRanges"];
  allowRestBreakBooking?: boolean;
  forceFullyBooked?: boolean;
  changeTimeAppointmentId?: string | null;
  onSlotClick: (time: string, options?: { vipOnly?: boolean }) => void;
  allowQuickSlotManagement?: boolean;
  customerFinanceSummaries?: Record<string, ManualFinanceCustomerSummary>;
  onChangeTimeSlotClick?: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

export function TimeSlotGrid({
  section,
  date,
  appointments,
  minimumBookableAt,
  blockedTimeRanges,
  allowRestBreakBooking = false,
  forceFullyBooked = false,
  changeTimeAppointmentId = null,
  onSlotClick,
  allowQuickSlotManagement = false,
  customerFinanceSummaries = {},
  onChangeTimeSlotClick,
  onAppointmentClick,
}: TimeSlotGridProps) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const format = useFormat();
  const canViewAppointmentDetails = user?.role === "admin" || user?.role === "barber";
  const canBookVipSlots = isAdmin || user?.role === "barber" || user?.isVip === true;

  const targetAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === changeTimeAppointmentId),
    [appointments, changeTimeAppointmentId],
  );
  const isChangeTimeMode = !!changeTimeAppointmentId && !!onChangeTimeSlotClick;

  const slots = useMemo(
    () => buildTimeSlots(
      section,
      appointments.filter((appointment) => !appointment.isOffQueue && appointment.id !== changeTimeAppointmentId),
      date,
      minimumBookableAt,
      blockedTimeRanges,
    ),
    [section, appointments, date, minimumBookableAt, blockedTimeRanges, changeTimeAppointmentId],
  );

  const offQueueAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.sectionId === section.id && appointment.status !== "cancelled" && appointment.isOffQueue)
        .sort((first, second) => first.startTime.localeCompare(second.startTime)),
    [appointments, section.id],
  );

  const renderedSlots = useMemo(
    () =>
      forceFullyBooked
        ? slots.map((slot) => ({
            ...slot,
            status: ["lead_time_blocked", "break", "barber_blocked", "quick_blocked"].includes(slot.status) ? slot.status : "booked",
            appointment: undefined,
          }))
        : slots,
    [forceFullyBooked, slots],
  );

  const gridItems = useMemo(
    () => {
      const slotItems = renderedSlots.map((slot) => ({ ...slot, type: "slot" as const }));
      const specialItems = offQueueAppointments.map((appointment): OffQueueItem => ({
        time: appointment.startTime,
        appointment,
        type: "off_queue",
      }));

      return [...slotItems, ...specialItems].sort((first, second) => {
        const compared = first.time.localeCompare(second.time);
        if (compared !== 0) {
          return compared;
        }

        return first.type === "off_queue" ? 1 : -1;
      });
    },
    [offQueueAppointments, renderedSlots],
  );

  const groupedItems = useMemo(() => {
    const displayPeriods = [
      { key: "morning", title: t("booking.timeSlots.period.morning"), fromHour: 0, toHour: 12 },
      { key: "afternoon", title: t("booking.timeSlots.period.afternoon"), fromHour: 12, toHour: 24 },
    ];

    return displayPeriods
      .map((period) => {
        const items = gridItems.filter((item) => {
          const hour = Number(item.time.split(":")[0] || 0);
          return hour >= period.fromHour && hour < period.toHour;
        });
        const freeCount = items.filter((item) => item.type === "slot" && item.status === "free").length;

        return { ...period, items, freeCount };
      })
      .filter((period) => period.items.length > 0);
  }, [gridItems, t]);

  const getStatusLabel = (
    slot: TimeSlotItem,
    options: {
      canViewAppointmentDetails: boolean;
      isOwnBookedSlot: boolean;
      isCurrentChangeTimeSlot: boolean;
      isChangeTimeMode: boolean;
      shouldShowQuickBlockedAsBooked: boolean;
    },
  ) => {
    if (slot.status === "quick_blocked" && options.canViewAppointmentDetails) {
      return t("booking.timeSlots.status.closedByAdmin");
    }

    if (slot.status === "booked") {
      if (options.isOwnBookedSlot && !options.canViewAppointmentDetails) {
        return t("booking.timeSlots.yourAppointment");
      }

      return options.canViewAppointmentDetails ? slot.appointment?.userName : t("booking.timeSlots.reserved");
    }

    if (options.isCurrentChangeTimeSlot) {
      return t("booking.timeSlots.status.currentTime");
    }

    if (slot.status === "pending_payment") {
      return t("booking.timeSlots.status.pendingPayment");
    }

    if (slot.status === "break") {
      return t("booking.timeSlots.status.break");
    }

    if (slot.status === "barber_blocked" || slot.status === "lead_time_blocked") {
      return t("booking.timeSlots.status.closed");
    }

    if (slot.status === "quick_blocked") {
      return options.shouldShowQuickBlockedAsBooked ? t("booking.timeSlots.reserved") : t("booking.timeSlots.status.closedByAdmin");
    }

    if (slot.status === "conflict" || slot.status === "overlapped") {
      return options.canViewAppointmentDetails ? t("booking.timeSlots.status.full") : t("booking.timeSlots.reserved");
    }

    if (options.isChangeTimeMode && slot.status === "free") {
      return t("booking.timeSlots.status.selectTime");
    }

    return slot.vipOnly ? t("booking.timeSlots.status.vip") : t("booking.timeSlots.status.free");
  };

  return (
    <div className="space-y-5">
      {groupedItems.map((group) => (
        <div key={group.key} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <h3 className="shrink-0 text-[16px] font-black text-[#eef3ff]">{group.title}</h3>
            <div className="h-px flex-1 bg-[#26344b]/70" />
            <p className="shrink-0 text-xs font-black text-[#8f9bb3]">
              {t("booking.timeSlots.freeCount", { count: format.number(group.freeCount) })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
      {group.items.map((item) => {
        if (item.type === "off_queue") {
          const appointment = item.appointment;
          const isOwnBookedSlot =
            !!user &&
            (appointment.userPhone === user.phone ||
              appointment.bookedByPhone === user.phone ||
              appointment.bookedByUserId === user.id);
          const canOpenBookedAppointment = canViewAppointmentDetails || isOwnBookedSlot;
          const isFilledForCustomer = !canViewAppointmentDetails && !isOwnBookedSlot;
          const attendanceBadge = canViewAppointmentDetails ? getAttendanceBadge(appointment, t) : null;
          const financeSummary = canViewAppointmentDetails ? customerFinanceSummaries[appointment.userPhone] : undefined;
          const hasFinance = financeSummary?.appointmentIds?.includes(appointment.id) ?? false;
          const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;
          const showOwnBookingStatus = isOwnBookedSlot && !canViewAppointmentDetails;
          const showOffQueueIcon = canViewAppointmentDetails || isOwnBookedSlot;
          const showNotesIcon =
            (canViewAppointmentDetails || isOwnBookedSlot) &&
            !!appointment.notes?.trim();

          return (
            <Button
              key={`off-queue-${appointment.id}`}
              variant="outline"
              data-slot-status="off-queue"
              data-own-booking={isOwnBookedSlot ? "true" : undefined}
              data-filled-slot={isFilledForCustomer ? "true" : undefined}
              className={cn(
                "relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-[#f6a21a]/70 bg-[#221d20] py-2 text-[#f6a21a] shadow-lg shadow-[#f6a21a]/10 transition-all duration-300 hover:bg-[#2a2422]",
                isOwnBookedSlot && "booking-own-slot",
              )}
              title={isFilledForCustomer ? t("booking.timeSlots.reservedTitle") : t("booking.timeSlots.offQueue")}
              aria-label={t("booking.timeSlots.slotAria", {
                label: isFilledForCustomer ? t("booking.timeSlots.reserved") : t("booking.timeSlots.offQueue"),
                time: appointment.startTime,
              })}
              onClick={() => {
                if (canOpenBookedAppointment) {
                  onAppointmentClick(appointment);
                  return;
                }

                toast({
                  variant: "destructive",
                  title: t("booking.timeSlots.alreadyBookedTitle"),
                  description: t("booking.timeSlots.chooseFreeDescription"),
                });
              }}
            >
              <span className="booking-own-slot-time text-[16px] font-black tracking-wider">{appointment.startTime}</span>
              <span className="booking-own-slot-label flex max-w-full items-center justify-center gap-1 truncate px-1 text-[10px] font-bold">
                {isFilledForCustomer && (
                  <span className="booking-own-slot-dot h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                )}
                {canViewAppointmentDetails ? appointment.userName : isOwnBookedSlot ? t("booking.timeSlots.yourAppointment") : t("booking.timeSlots.reserved")}
              </span>
              {(showOwnBookingStatus || attendanceBadge || hasFinance || hasDebt || showOffQueueIcon || showNotesIcon) && (
                <span className="-mb-1 -mt-px inline-flex h-3 items-center justify-center gap-0.5 rounded-full bg-[#07101d]/70 px-1 py-0 leading-none ring-1 ring-white/10" dir="ltr">
                  {hasDebt && <AlertTriangle className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-rose-200" />}
                  {hasFinance && <DollarSign className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-amber-200" />}
                  {attendanceBadge?.icon === "completed" && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-emerald-200" />}
                  {attendanceBadge?.icon === "no_show" && <UserRoundX className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-rose-200" />}
                  {showOwnBookingStatus && <Check className="h-2.5 w-2.5 shrink-0 stroke-[2] text-white" />}
                  {showOffQueueIcon && (
                    <UserRoundPlus
                      className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-sky-200"
                      aria-label={t("booking.timeSlots.manualOffQueueByAdmin")}
                    />
                  )}
                  {showNotesIcon && (
                    <MessageSquareText
                      className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-violet-200"
                      aria-label={t("booking.timeSlots.hasNotes")}
                    />
                  )}
                </span>
              )}
            </Button>
          );
        }

        const slot = item;
        const isCurrentChangeTimeSlot =
          isChangeTimeMode &&
          !!targetAppointment &&
          targetAppointment.sectionId === section.id &&
          targetAppointment.startTime === slot.time;
        const isInteractable =
          (slot.status === 'free' && (!slot.vipOnly || canBookVipSlots)) ||
          (isAdmin && slot.status === 'overlapped') ||
          (allowRestBreakBooking && slot.status === 'break');
        const isOwnBookedSlot =
          !!user &&
          !!slot.appointment &&
          (slot.appointment.userPhone === user.phone ||
            slot.appointment.bookedByPhone === user.phone ||
            slot.appointment.bookedByUserId === user.id);
        const canOpenBookedAppointment = canViewAppointmentDetails || isOwnBookedSlot;
        const showOtherPersonIcon =
          canViewAppointmentDetails &&
          slot.appointment?.isForSomeoneElse &&
          slot.appointment?.bookedByRole === "customer";
        const showNotesIcon =
          (canViewAppointmentDetails || isOwnBookedSlot) &&
          !!slot.appointment?.notes?.trim();
        const attendanceBadge = canViewAppointmentDetails ? getAttendanceBadge(slot.appointment, t) : null;
        const financeSummary = canViewAppointmentDetails && slot.appointment ? customerFinanceSummaries[slot.appointment.userPhone] : undefined;
        const hasFinance = !!slot.appointment && (financeSummary?.appointmentIds?.includes(slot.appointment.id) ?? false);
        const hasDebt = (financeSummary?.balanceAmount ?? 0) > 0;
        const showOwnBookingStatus = isOwnBookedSlot && !canViewAppointmentDetails;
        const isClosedLikeSlot = !isInteractable && !["booked", "pending_payment"].includes(slot.status);
        const isQuickBlockedSlot = slot.status === "quick_blocked";
        const shouldShowQuickBlockedAsBooked = isQuickBlockedSlot && !canViewAppointmentDetails;
        const occupiedStatus = shouldShowQuickBlockedAsBooked ? "booked" : slot.status;
        const isFilledForCustomer =
          !canViewAppointmentDetails &&
          !isOwnBookedSlot &&
          ["booked", "overlapped", "conflict", "quick_blocked"].includes(slot.status);
        const shouldHighlightBookedSlot =
          (slot.status === "booked" || slot.status === "overlapped") &&
          (isAdmin || isOwnBookedSlot);
        
        // Visual logic
        let bgClass = "border-[#273753] bg-[#17243d] text-[#f5f7ff] hover:border-[#40547a] hover:bg-[#1b2c4d]";
        let textClass = "text-[#f5f7ff]";
        let statusClass = "text-[#8f9bb3]";
        let dotClass = "bg-emerald-400";
        let timeClass = "";
        
        if (slot.status === 'booked') {
           if (shouldHighlightBookedSlot) {
             bgClass = "border-[#f6a21a]/75 bg-[linear-gradient(135deg,rgba(246,162,26,0.22),rgba(246,162,26,0.09))] text-[#fff2ce] shadow-md shadow-[#f6a21a]/10 hover:border-[#ffb22f] hover:bg-[#f6a21a]/20";
             textClass = "text-[#fff2ce]";
             statusClass = "text-[#f6bd5d]";
             dotClass = "bg-[#f6a21a]";
           } else {
             bgClass = "cursor-not-allowed border-red-500 bg-red-600 text-white shadow-md shadow-red-950/20";
             textClass = "text-white";
             statusClass = "text-red-100";
             dotClass = "bg-white";
           }
        } else if (slot.status === "pending_payment") {
           bgClass = "border-sky-400/35 bg-sky-500/10 text-sky-100 cursor-not-allowed";
           textClass = "text-sky-100";
           statusClass = "text-sky-200/75";
           dotClass = "bg-sky-300";
        } else if (slot.status === 'conflict') {
           bgClass = "cursor-not-allowed border-red-500 bg-red-600 text-white shadow-md shadow-red-950/20";
           textClass = "text-white";
           statusClass = "text-red-100";
           dotClass = "bg-white";
        } else if (slot.status === 'overlapped') {
           if (shouldHighlightBookedSlot) {
             bgClass = "border-[#f6a21a]/65 bg-[#f6a21a]/12 text-[#ffe8b5] shadow-sm shadow-[#f6a21a]/10";
             textClass = "text-[#ffe8b5]";
             statusClass = "text-[#e9ae4b]";
             dotClass = "bg-[#f6a21a]";
           } else {
             bgClass = "cursor-not-allowed border-red-500 bg-red-600 text-white shadow-md shadow-red-950/20";
             textClass = "text-white";
             statusClass = "text-red-100";
             dotClass = "bg-white";
           }
        } else if (slot.status === "break") {
           bgClass = "border-[#1d2a3f] bg-[#101827] text-[#4f5a70] cursor-not-allowed opacity-80";
           textClass = "text-[#4f5a70]";
           statusClass = "text-[#59647a]";
           dotClass = "bg-[#4f5a70]";
        } else if (slot.status === "barber_blocked") {
           if (canViewAppointmentDetails) {
             bgClass = "border-[#5b4324] bg-[#211b18] text-[#9b8060] cursor-not-allowed opacity-90";
             textClass = "text-[#9b8060]";
             statusClass = "text-[#a98b66]";
             dotClass = "bg-[#b88749]";
           } else {
             bgClass = "border-[#1d2a3f] bg-[#101827] text-[#4f5a70] cursor-not-allowed opacity-80";
             textClass = "text-[#4f5a70]";
             statusClass = "text-[#59647a]";
             dotClass = "bg-[#4f5a70]";
           }
        } else if (slot.status === "quick_blocked") {
           if (canViewAppointmentDetails) {
             bgClass = allowQuickSlotManagement
               ? "border-[#8f5a2c]/80 bg-[linear-gradient(135deg,rgba(72,48,31,0.92),rgba(31,24,22,0.94))] text-[#ffd9a0] shadow-md shadow-[#120b06]/25 hover:border-[#f6a21a]/70 hover:bg-[#33261d]"
               : "border-[#5b4324] bg-[#211b18] text-[#9b8060] cursor-not-allowed opacity-90";
             textClass = allowQuickSlotManagement ? "text-[#ffe2ae]" : "text-[#9b8060]";
             statusClass = allowQuickSlotManagement ? "text-[#f4bd73]" : "text-[#a98b66]";
             dotClass = "bg-[#f6a21a]";
           } else {
             bgClass = "cursor-not-allowed border-red-500 bg-red-600 text-white shadow-md shadow-red-950/20";
             textClass = "text-white";
             statusClass = "text-red-100";
             dotClass = "bg-white";
           }
        } else if (slot.status === "lead_time_blocked") {
           bgClass = "border-[#1d2a3f] bg-[#101827] text-[#4f5a70] cursor-not-allowed opacity-80";
           textClass = "text-[#4f5a70]";
           statusClass = "text-[#59647a]";
           dotClass = "bg-[#4f5a70]";
        } else if (slot.vipOnly) {
           bgClass = "border-[#7e63c8] bg-[#1a1a35] text-white shadow-[0_0_0_1px_rgba(126,99,200,0.24)] hover:bg-[#201f42]";
           textClass = "text-white";
           statusClass = "text-[#bba6ff]";
           dotClass = "bg-[#9d7cff]";
        }

        if (isChangeTimeMode) {
          if (isCurrentChangeTimeSlot) {
            bgClass = "border-amber-300/70 bg-[linear-gradient(135deg,rgba(245,158,11,0.28),rgba(251,191,36,0.14))] text-amber-50 shadow-lg shadow-amber-500/15 ring-1 ring-amber-200/25";
            textClass = "text-amber-50";
          } else if (slot.status === "free" || (slot.status === "break" && allowRestBreakBooking)) {
            bgClass = "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(255,255,255,0.045))] text-emerald-50 shadow-sm shadow-emerald-500/5 ring-1 ring-white/5 hover:border-emerald-200/70 hover:bg-emerald-400/16 hover:shadow-lg hover:shadow-emerald-500/10";
            textClass = "text-emerald-50";
          } else {
            bgClass = "border-white/10 bg-white/[0.035] text-muted-foreground cursor-not-allowed opacity-60 grayscale";
            textClass = "text-muted-foreground";
          }
        }

        if (isClosedLikeSlot) {
          timeClass = "line-through decoration-2 decoration-current/80 underline-offset-4";
        }

        return (
          <Button
            key={slot.time}
            variant="outline"
            data-slot-status={occupiedStatus}
            data-own-booking={isOwnBookedSlot && slot.status === "booked" ? "true" : undefined}
            data-filled-slot={isFilledForCustomer || shouldShowQuickBlockedAsBooked ? "true" : undefined}
            data-vip-only={slot.vipOnly ? "true" : undefined}
            data-change-time-mode={isChangeTimeMode ? "true" : undefined}
            data-change-time-current={isCurrentChangeTimeSlot ? "true" : undefined}
            className={cn(
              "relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1.5 py-2 transition-all duration-300",
              bgClass,
              isOwnBookedSlot && slot.status === "booked" && "booking-own-slot",
            )}
            onClick={() => {
                if (isChangeTimeMode) {
                    if (isCurrentChangeTimeSlot) {
                      toast({
                        title: t("booking.timeSlots.currentTimeTitle"),
                        description: t("booking.timeSlots.chooseAnotherTimeDescription"),
                      });
                      return;
                    }

                    if (slot.vipOnly && !canBookVipSlots) {
                      toast({
                        variant: "destructive",
                        title: t("booking.timeSlots.vipTitle"),
                        description: t("booking.timeSlots.vipUnavailableForUserDescription"),
                      });
                      return;
                    }

                    if (slot.status === "free" || (slot.status === "break" && allowRestBreakBooking)) {
                      onChangeTimeSlotClick?.(slot.time);
                      return;
                    }

                    toast({
                      variant: "destructive",
                      title: t("booking.timeSlots.unselectableTitle"),
                      description: t("booking.timeSlots.chooseFreeForChangeDescription"),
                    });
                    return;
                }

                if ((slot.status === 'booked' || slot.status === 'pending_payment') && slot.appointment) {
                    if (slot.status === "pending_payment") {
                      toast({
                        variant: "destructive",
                        title: t("booking.timeSlots.pendingPaymentTitle"),
                        description: t("booking.timeSlots.pendingPaymentDescription"),
                      });
                      return;
                    }
                    if (canOpenBookedAppointment) {
                      onAppointmentClick(slot.appointment);
                    } else {
                      toast({
                        variant: "destructive",
                        title: t("booking.timeSlots.reservedTitle"),
                        description: t("booking.timeSlots.chooseFreeDescription"),
                      });
                    }
                } else if (slot.vipOnly && !canBookVipSlots) {
                    toast({
                      variant: "destructive",
                      title: t("booking.timeSlots.vipTitle"),
                      description: t("booking.timeSlots.vipUnavailableForYouDescription"),
                    });
                } else if (slot.status === 'free') {
                    onSlotClick(slot.time, { vipOnly: slot.vipOnly });
                } else if (slot.status === "quick_blocked" && allowQuickSlotManagement) {
                    onSlotClick(slot.time, { vipOnly: slot.vipOnly });
                } else if (slot.status === 'break' && allowRestBreakBooking) {
                    onSlotClick(slot.time, { vipOnly: slot.vipOnly });
                } else if (slot.status === 'overlapped' && isAdmin) {
                     // Admin override logic (maybe warn?)
                     onSlotClick(slot.time, { vipOnly: slot.vipOnly });
                } else {
                    toast({
                      variant: "destructive",
                      title: t("booking.timeSlots.closedTitle"),
                      description: t("booking.timeSlots.chooseActiveDescription"),
                    });
                }
            }}
          >
            {slot.vipOnly && (
              <span
                className={cn(
                  "absolute start-2 inline-flex h-2.5 w-2.5 rotate-45 border-2 border-[#9d7cff]",
                  attendanceBadge ? "top-6" : "top-2",
                )}
                title={t("booking.timeSlots.vipOnlyTitle")}
              >
              </span>
            )}
            <span className={cn("booking-own-slot-time text-[16px] font-black leading-none tracking-wider", textClass, timeClass)}>{slot.time}</span>
            <span
              className={cn(
                "booking-own-slot-label flex max-w-full items-center gap-1 truncate px-1 text-[10px] font-black",
                statusClass,
                !isInteractable && !["booked", "pending_payment"].includes(slot.status) ? "font-semibold" : "",
              )}
            >
              <span
                className={cn(
                  "booking-own-slot-dot h-1.5 w-1.5 shrink-0 rounded-full",
                  dotClass,
                  slot.status === "free" && !slot.vipOnly ? "booking-free-slot-dot" : "",
                )}
              />
              {getStatusLabel(slot, {
                canViewAppointmentDetails,
                isOwnBookedSlot,
                isCurrentChangeTimeSlot,
                isChangeTimeMode,
                shouldShowQuickBlockedAsBooked,
              })}
            </span>
            {slot.status === "quick_blocked" && canViewAppointmentDetails && (
              <span className="-mb-1 -mt-px inline-flex h-3 items-center justify-center rounded-full bg-[#07101d]/70 px-1.5 py-0 leading-none ring-1 ring-white/10" dir="ltr" title={t("booking.timeSlots.closedByAdminTitle")}>
                <Lock className="h-2.5 w-2.5 shrink-0 stroke-[1.9] text-[#ffd08a]" />
              </span>
            )}
            {slot.status === "booked" && (showOwnBookingStatus || attendanceBadge || hasFinance || hasDebt || showOtherPersonIcon || showNotesIcon) && (
              <span className="-mb-1 -mt-px inline-flex h-3 items-center justify-center gap-0.5 rounded-full bg-[#07101d]/70 px-1 py-0 leading-none ring-1 ring-white/10" dir="ltr">
                {hasDebt && <AlertTriangle className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-rose-200" />}
                {hasFinance && <DollarSign className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-amber-200" />}
                {attendanceBadge?.icon === "completed" && <CheckCircle2 className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-emerald-200" />}
                {attendanceBadge?.icon === "no_show" && <UserRoundX className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-rose-200" />}
                {showOwnBookingStatus && <Check className="h-2.5 w-2.5 shrink-0 stroke-[2] text-white" />}
                {showOtherPersonIcon && <Users className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-sky-200" />}
                {showNotesIcon && (
                  <MessageSquareText
                    className="h-2.5 w-2.5 shrink-0 stroke-[1.75] text-violet-200"
                    aria-label={t("booking.timeSlots.hasNotes")}
                  />
                )}
              </span>
            )}
          </Button>
        );
      })}
          </div>
        </div>
      ))}
    </div>
  );
}
