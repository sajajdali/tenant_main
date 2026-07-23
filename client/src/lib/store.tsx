import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Appointment, Section, Barber, ApiResponse } from "./types";
import { api } from "./api";
import { useAuth } from "./auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { subscribeAppointmentAvailability } from "./realtime";
import { useFormat, useT } from "@/i18n/locale";

const ADMIN_BARBER_STORAGE_KEY = "barber_admin_selected_barber";
const PUBLIC_BARBER_STORAGE_KEY = "booking_selected_barber";

interface StoreContextType {
  barbers: Barber[];
  sections: Section[];
  appointments: Appointment[];
  loading: boolean;
  barbersLoaded: boolean;
  sectionsLoaded: boolean;
  sectionsBarberId: string;
  currentDate: string; // YYYY-MM-DD
  currentBarberId: string;
  setCurrentDate: (date: string) => void;
  setCurrentBarberId: (id: string) => void;
  fetchAppointments: () => Promise<void>;
  createAppointment: (data: Partial<Appointment>) => Promise<boolean>;
  cancelAppointment: (id: string, sendSms?: boolean) => Promise<boolean>;
  bulkCancel: (ids: string[], sendSms?: boolean) => Promise<boolean>;
  cancelByDates: (dates: string[]) => Promise<number>;
  
  // Admin Methods
  addBarber: (name: string, mobile: string, sortOrder?: number, apiCode?: string) => Promise<{ success: boolean; message?: string }>;
  updateBarber: (barber: Barber) => Promise<boolean>;
  deleteBarber: (id: string) => Promise<boolean>;
  addSection: (data: Partial<Section>) => Promise<boolean>;
  updateSection: (section: Section, options?: { silent?: boolean }) => Promise<boolean>;
  deleteSection: (id: string) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [currentBarberId, setCurrentBarberId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [barbersLoaded, setBarbersLoaded] = useState(false);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [sectionsBarberId, setSectionsBarberId] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const localeFormat = useFormat();

  const loadBarbers = useCallback(() => {
      setBarbersLoaded(false);
      api.barbers.list().then(res => {
          if (res.success) {
              setBarbers(res.data);

              const activeBarbers = res.data.filter((barber) => barber.isActive);
              setCurrentBarberId((currentBarberId) => {
                  const currentBarberStillExists = activeBarbers.some((barber) => barber.id === currentBarberId);
                  if (currentBarberStillExists) {
                      return currentBarberId;
                  }

                  const savedBarberId =
                    user?.role === "admin"
                      ? localStorage.getItem(ADMIN_BARBER_STORAGE_KEY)
                      : localStorage.getItem(PUBLIC_BARBER_STORAGE_KEY);
                  const savedBarberExists =
                    !!savedBarberId && activeBarbers.some((barber) => barber.id === savedBarberId);

                  if (savedBarberExists) {
                      return savedBarberId!;
                  }

                  if (activeBarbers.length === 1) {
                      return activeBarbers[0].id;
                  }

                  return "";
              });
          }
      }).finally(() => {
          setBarbersLoaded(true);
      });
  }, [user?.role]);

  const loadSections = useCallback(() => {
    if (!currentBarberId) {
        setSectionsBarberId("");
        setSectionsLoaded(true);
        setSections([]);
        setAppointments([]);
        return;
    }

    let cancelled = false;
    setSectionsLoaded(false);
    setSectionsBarberId("");
    setSections([]);
    api.sections.list(currentBarberId).then(res => {
        if (!cancelled && res.success) {
            setSections(res.data.filter((section) => section.isActive));
        }
    }).finally(() => {
        if (!cancelled) {
            setSectionsBarberId(currentBarberId);
            setSectionsLoaded(true);
        }
    });

    return () => {
        cancelled = true;
    };
  }, [currentBarberId]);

  // Initial Load
  useEffect(() => {
      loadBarbers();
  }, [loadBarbers, user?.id, user?.role]);

  // Load Sections when Barber changes
  useEffect(() => {
    return loadSections();
  }, [loadSections]);

  const fetchAppointments = useCallback(async () => {
    if (!currentBarberId) return;
    setLoading(true);
    const res = await api.appointments.list(currentDate, currentBarberId);
    if (res.success) {
      setAppointments(res.data);
    }
    setLoading(false);
  }, [currentDate, currentBarberId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!currentDate || !currentBarberId) return;

    return subscribeAppointmentAvailability(currentDate, currentBarberId, () => {
      fetchAppointments();
    });
  }, [currentDate, currentBarberId, fetchAppointments]);

  useEffect(() => {
    if (!currentBarberId) {
      return;
    }

    if (user?.role === "admin") {
      localStorage.setItem(ADMIN_BARBER_STORAGE_KEY, currentBarberId);
      return;
    }

    localStorage.setItem(PUBLIC_BARBER_STORAGE_KEY, currentBarberId);
  }, [currentBarberId, user]);

  const createAppointment = async (data: Partial<Appointment>) => {
    if (user?.role === "customer" && user.canBook === false) {
      toast({
        variant: "destructive",
        title: t("store.booking.disabledTitle"),
        description: t("store.booking.disabledDescription"),
      });
      return false;
    }
    const res = await api.appointments.create({ ...data, barberId: currentBarberId }, user);
    if (res.success) {
      const appointmentStartsAt =
        data.date && data.startTime ? new Date(`${data.date}T${data.startTime}:00`).getTime() : null;
      const isPastAppointment = appointmentStartsAt !== null && appointmentStartsAt < Date.now();
      toast({
        title: t("store.appointment.createdTitle"),
        description: isPastAppointment
          ? t("store.appointment.createdPastDescription")
          : t("store.appointment.createdDescription"),
      });
      fetchAppointments();
      return true;
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
    }
  };

  const cancelAppointment = async (id: string, sendSms = false) => {
    if (!user) return false;
    const res = await api.appointments.cancel(id, user.id, user.role === 'admin', sendSms);
    if (res.success) {
      toast({
        title: t("store.appointment.cancelledTitle"),
        description: sendSms ? t("store.appointment.cancelledWithSmsDescription") : undefined,
      });
      fetchAppointments();
      return true;
    } else {
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
    }
  };
  
  const bulkCancel = async (ids: string[], sendSms = false) => {
      const res = await api.appointments.bulkCancel(ids, sendSms);
      if(res.success) {
          toast({
            title: t("store.appointment.bulkCancelledTitle"),
            description: sendSms
              ? t("store.appointment.bulkCancelledWithSmsDescription", {
                  count: localeFormat.number(res.data.cancelledCount),
                  smsCount: localeFormat.number(res.data.smsSentCount),
                })
              : t("store.appointment.bulkCancelledDescription", {
                  count: localeFormat.number(res.data.cancelledCount),
                }),
          });
          await fetchAppointments();
          return true;
      }
      return false;
  }

  const cancelByDates = async (dates: string[]) => {
      const res = await api.appointments.cancelByDates(dates);
      if (res.success) {
          toast({
            title: t("store.appointment.bulkDateCancelledTitle"),
            description: t("store.appointment.bulkDateCancelledDescription", {
              count: localeFormat.number(res.data),
            }),
          });
          fetchAppointments();
          return res.data;
      }
      return 0;
  }
  
  // Admin Actions
  const addBarber = async (name: string, mobile: string, sortOrder?: number, apiCode?: string) => {
      const res = await api.barbers.create(name, mobile, sortOrder, apiCode);
      if(res.success) {
          toast({ title: t("store.barber.added") });
          loadBarbers();
          return { success: true };
      }
      return { success: false, message: res.message };
  }

  const updateBarber = async (barber: Barber) => {
      const payload =
        user?.role === "barber"
          ? {
              ...barber,
              name: undefined,
              mobile: undefined,
              apiCode: undefined,
              sortOrder: undefined,
              canAccessPanel: undefined,
              isActive: undefined,
            }
          : barber;

      const res = await api.barbers.update(payload);
      if(res.success) {
          toast({ title: t("store.barber.updated") });
          loadBarbers();
          return true;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
  }

  const deleteBarber = async (id: string) => {
      const res = await api.barbers.delete(id);
      if(res.success) {
          toast({ title: t("store.barber.deleted") });
          loadBarbers();
          return true;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
  }

  const addSection = async (data: Partial<Section>) => {
      const res = await api.sections.create(data);
      if(res.success) {
          // Refresh sections if added to current barber
          if (data.barberId === currentBarberId) {
             const listRes = await api.sections.list(currentBarberId);
             if(listRes.success) setSections(listRes.data);
          }
          toast({ title: t("store.section.added") });
          return true;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
  }

  const updateSection = async (section: Section, options?: { silent?: boolean }) => {
      const res = await api.sections.update(section);
      if(res.success) {
          setSections(prev => prev.map(s => s.id === section.id ? res.data : s));
          if (!options?.silent) {
              toast({ title: t("store.section.settingsSaved") });
          }
          return true;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
  }

  const deleteSection = async (id: string) => {
      const res = await api.sections.delete(id);
      if(res.success) {
          setSections(prev => prev.filter(s => s.id !== id));
          toast({ title: t("store.section.deleted") });
          return true;
      }
      toast({ variant: "destructive", title: t("common.error"), description: res.message });
      return false;
  }

  return (
    <StoreContext.Provider
      value={{
        barbers,
        sections,
        appointments,
        loading,
        barbersLoaded,
        sectionsLoaded,
        sectionsBarberId,
        currentDate,
        currentBarberId,
        setCurrentDate,
        setCurrentBarberId,
        fetchAppointments,
        createAppointment,
        cancelAppointment,
        bulkCancel,
        cancelByDates,
        addBarber,
        updateBarber,
        deleteBarber,
        addSection,
        updateSection,
        deleteSection
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
