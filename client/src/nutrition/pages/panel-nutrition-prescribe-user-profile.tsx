import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Dumbbell,
  Pencil,
  Gift,
  Loader2,
  Lock,
  LockOpen,
  PackagePlus,
  Phone,
  Scale,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import type { NutritionAdminUserProfilePayload, NutritionPackageItem } from "@/lib/types";
import {
  updatePanelNutritionPrescribeState,
} from "@/nutrition/lib/panel-nutrition-prescribe-state";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MedicalConditionsSummary } from "@/nutrition/components/medical-conditions-summary";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { PhoneText } from "@/i18n/ltr-text";
import { useFormat, useLocale, useT } from "@/i18n/locale";

const parseCreditDelta = (value: string) => Number(value.trim() || 0);

type SubscriptionDateDraft = {
  subscriptionId: string;
  startsAt: string;
  endsAt: string;
};

type CreditDraft = {
  onlineDietDelta: string;
  offlineDietDelta: string;
  notes: string;
};

function toSafeGregorianDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function normalizeWeightInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0].slice(0, 3);
  }

  return `${parts[0].slice(0, 3)}.${parts.slice(1).join("").slice(0, 2)}`;
}

type Translator = ReturnType<typeof useT>;

const getPrescriptionModeLabel = (value: string | null | undefined, t: Translator) => {
  if (value === "user_choice") return t("panelNutritionPrescribeUserProfile.mode.userChoice");
  if (value === "daily_prescription") return t("panelNutritionPrescribeUserProfile.mode.dailyPrescription");
  if (value === "fixed_text") return t("panelNutritionPrescribeUserProfile.mode.fixedText");
  return "—";
};

const getPrescriptionDateValue = (item: NutritionAdminUserProfilePayload["prescriptions"][number]) => (
  item.startedAt ?? item.publishedAt ?? item.endsAt ?? ""
);

const getPrescriptionTime = (item: NutritionAdminUserProfilePayload["prescriptions"][number]) => {
  const value = getPrescriptionDateValue(item);
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

function flattenPackages(items: NutritionPackageItem[]): NutritionPackageItem[] {
  return items.flatMap((item) => [item, ...flattenPackages(item.children ?? [])]);
}

export default function PanelNutritionPrescribeUserProfilePage() {
  const [, params] = useRoute("/panel/nutrition/prescribe/users/:mobile");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const t = useT();
  const localeFormat = useFormat();
  const { dir, isRtl } = useLocale();
  const { isAdmin, isBarber, user } = useAuth();
  const { barbers, currentBarberId } = useStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [subscriptionDateDraft, setSubscriptionDateDraft] = useState<SubscriptionDateDraft | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditDraft, setCreditDraft] = useState<CreditDraft>({
    onlineDietDelta: "0",
    offlineDietDelta: "0",
    notes: "",
  });
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [latestWeightDraft, setLatestWeightDraft] = useState("");
  const [profileData, setProfileData] = useState<NutritionAdminUserProfilePayload | null>(null);
  const [packages, setPackages] = useState<NutritionPackageItem[]>([]);
  const [managerMessageDraft, setManagerMessageDraft] = useState("");
  const ForwardArrow = isRtl ? ArrowLeft : ArrowRight;
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const formatDate = (value?: string | null) => (value ? localeFormat.date(value) : "—");
  const formatNumber = (value: number, maximumFractionDigits = 0) => localeFormat.number(value, { maximumFractionDigits });
  const formatWeight = (value?: number | null) => (
    value != null
      ? t("panelNutritionPrescribeUserProfile.units.kg", { value: formatNumber(value, 1) })
      : "—"
  );

  const mobile = useMemo(() => decodeURIComponent(params?.mobile ?? "").trim(), [params?.mobile]);
  const backHref = useMemo(() => {
    const query = location.includes("?")
      ? location.slice(location.indexOf("?"))
      : typeof window !== "undefined"
        ? window.location.search
        : "";
    const returnTo = new URLSearchParams(query).get("returnTo") ?? "";

    return returnTo.startsWith("/panel/nutrition/requests/")
      ? returnTo
      : "/panel/nutrition/prescribe";
  }, [location]);
  const ownBarber = useMemo(
    () => (isBarber ? barbers.find((barber) => barber.userId === user?.id) ?? null : null),
    [barbers, isBarber, user?.id],
  );
  const resolvedBarberId = isBarber ? ownBarber?.id ?? "" : currentBarberId || barbers[0]?.id || "";
  const isSubscriptionDateDraftValid = Boolean(
    subscriptionDateDraft?.startsAt
    && subscriptionDateDraft?.endsAt
    && subscriptionDateDraft.endsAt >= subscriptionDateDraft.startsAt,
  );
  const onlineDietDelta = parseCreditDelta(creditDraft.onlineDietDelta);
  const offlineDietDelta = parseCreditDelta(creditDraft.offlineDietDelta);
  const hasValidCreditDraft = Number.isInteger(onlineDietDelta)
    && Number.isInteger(offlineDietDelta)
    && onlineDietDelta >= -1000
    && onlineDietDelta <= 1000
    && offlineDietDelta >= -1000
    && offlineDietDelta <= 1000
    && (onlineDietDelta !== 0 || offlineDietDelta !== 0);

  const loadProfile = async () => {
    if (!mobile) {
      return;
    }

    setLoading(true);
    const [profileResult, packagesResult] = await Promise.all([
      api.nutritionAdminUsers.show(mobile),
      api.nutritionPackages.list(),
    ]);

    if (profileResult.success) {
      setProfileData(profileResult.data);
      setManagerMessageDraft(profileResult.data.user.nutritionProfileFixedMessage ?? "");
      updatePanelNutritionPrescribeState({
        isNewUser: false,
        selectedUser: {
          id: profileResult.data.user.id,
          fullName: profileResult.data.user.fullName,
          mobile: profileResult.data.user.mobile,
          gender: (profileResult.data.profile?.gender as "male" | "female" | null | undefined) ?? null,
          birthDate: profileResult.data.profile?.birthDate ?? profileResult.data.user.birthDate ?? null,
        },
        fullName: profileResult.data.user.fullName,
        mobile: profileResult.data.user.mobile,
        dietGoal: (profileResult.data.profile?.dietGoal as "lose-weight" | "gain-weight" | "maintain-weight" | undefined) ?? undefined,
        gender: (profileResult.data.profile?.gender as "male" | "female" | null | undefined) ?? undefined,
        athleteMode: (profileResult.data.profile?.athleteMode as "athlete" | "non-athlete" | undefined) ?? undefined,
        activityLevel: (profileResult.data.profile?.activityLevel as "very-low" | "medium" | "high" | "intense" | undefined) ?? undefined,
        birthDate: profileResult.data.profile?.birthDate ?? profileResult.data.user.birthDate ?? undefined,
        heightCm: profileResult.data.profile?.heightCm ?? undefined,
        weightKg: profileResult.data.profile?.weightKg != null ? String(profileResult.data.profile.weightKg) : undefined,
        targetWeightKg: profileResult.data.profile?.targetWeightKg != null ? String(profileResult.data.profile.targetWeightKg) : undefined,
        weeklyWeightChangeKg: profileResult.data.profile?.weeklyWeightChangeKg ?? undefined,
        medicalConditions: profileResult.data.profile?.medicalConditions ?? undefined,
        medicalConditionsItems: profileResult.data.profile?.medicalConditionsItems ?? undefined,
        medicationsAndSupplements: profileResult.data.profile?.medicationsAndSupplements ?? undefined,
        foodAllergies: profileResult.data.profile?.foodAllergies ?? undefined,
        dislikedFoods: profileResult.data.profile?.dislikedFoods ?? undefined,
        mindsetAnswers: profileResult.data.profile?.mindsetAnswers ?? undefined,
      });
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.profileNotFound"),
        description: profileResult.message,
      });
      setLocation("/panel/nutrition/prescribe");
    }

    if (packagesResult.success) {
      setPackages(flattenPackages(packagesResult.data.items ?? []).filter((item) => item.isActive));
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  const handleToggleAccess = async () => {
    if (!profileData) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionAdminUsers.updateAccess(profileData.user.mobile, !profileData.user.canBook);

    if (result.success) {
      toast({
        title: profileData.user.canBook
          ? t("panelNutritionPrescribeUserProfile.toast.profileClosed")
          : t("panelNutritionPrescribeUserProfile.toast.profileOpened"),
        description: result.message,
      });
      await loadProfile();
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.accessUpdateFailed"),
        description: result.message,
      });
    }

    setSubmitting(false);
  };

  const handleSaveManagerMessage = async (nextMessage = managerMessageDraft) => {
    if (!profileData) {
      return;
    }

    if (!resolvedBarberId) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.specialistMissing"),
        description: t("panelNutritionPrescribeUserProfile.toast.specialistMissingDescription"),
      });
      return;
    }

    setSubmitting(true);
    const result = await api.users.updateIdentity(profileData.user.mobile, resolvedBarberId, {
      name: profileData.user.fullName,
      mobile: profileData.user.mobile,
      email: profileData.user.email ?? null,
      gender: profileData.user.gender ?? null,
      nationalCode: profileData.user.nationalCode ?? null,
      birthDate: profileData.user.birthDate ?? null,
      provinceId: profileData.user.provinceId ?? null,
      provinceName: profileData.user.provinceName ?? null,
      cityId: profileData.user.cityId ?? null,
      cityName: profileData.user.cityName ?? null,
      jobTitle: profileData.user.jobTitle ?? null,
      nutritionProfileFixedMessage: nextMessage.trim() || null,
    });
    setSubmitting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.managerMessageFailed"),
        description: result.message,
      });
      return;
    }

    setProfileData((current) => (current
      ? {
          ...current,
          user: {
            ...current.user,
            nutritionProfileFixedMessage: result.data.nutritionProfileFixedMessage ?? null,
          },
        }
      : current));
    setManagerMessageDraft(result.data.nutritionProfileFixedMessage ?? "");

    toast({
      title: t("panelNutritionPrescribeUserProfile.toast.managerMessageSaved"),
      description: result.data.nutritionProfileFixedMessage
        ? t("panelNutritionPrescribeUserProfile.toast.managerMessageShown")
        : t("panelNutritionPrescribeUserProfile.toast.managerMessageRemoved"),
    });
  };

  const handleGrantPackage = async (packageId: string) => {
    if (!profileData) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionAdminUsers.grantPackage(profileData.user.mobile, packageId);

    if (result.success) {
      toast({
        title: t("panelNutritionPrescribeUserProfile.toast.packageGranted"),
        description: result.message || t("panelNutritionPrescribeUserProfile.toast.packageGrantedDescription"),
      });
      setPackageDialogOpen(false);
      await loadProfile();
    } else {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.packageGrantFailed"),
        description: result.message,
      });
    }

    setSubmitting(false);
  };

  const openSubscriptionDateEdit = () => {
    if (!profileData?.subscription) {
      return;
    }

    setSubscriptionDateDraft({
      subscriptionId: profileData.subscription.id,
      startsAt: profileData.subscription.startsAt || format(new Date(), "yyyy-MM-dd"),
      endsAt: profileData.subscription.endsAt || format(new Date(), "yyyy-MM-dd"),
    });
  };

  const handleSaveSubscriptionDates = async () => {
    if (!profileData || !subscriptionDateDraft || !isSubscriptionDateDraftValid) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionAdminUsers.updateSubscriptionDates(profileData.user.mobile, subscriptionDateDraft.subscriptionId, {
      startsAt: subscriptionDateDraft.startsAt,
      endsAt: subscriptionDateDraft.endsAt,
    });
    setSubmitting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.subscriptionDateFailed"),
        description: result.message,
      });
      return;
    }

    setProfileData((current) => current
      ? {
          ...current,
          subscription: result.data.subscription,
        }
      : current);
    setSubscriptionDateDraft(null);
    toast({
      title: t("panelNutritionPrescribeUserProfile.toast.subscriptionDateSaved"),
      description: result.message,
    });
  };

  const openCreditDialog = () => {
    setCreditDraft({
      onlineDietDelta: "0",
      offlineDietDelta: "0",
      notes: "",
    });
    setCreditDialogOpen(true);
  };

  const handleSaveCredits = async () => {
    if (!profileData?.subscription || !hasValidCreditDraft) {
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionAdminUsers.adjustSubscriptionCredits(profileData.user.mobile, profileData.subscription.id, {
      onlineDietDelta,
      offlineDietDelta,
      notes: creditDraft.notes,
    });
    setSubmitting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.creditUpdateFailed"),
        description: result.message,
      });
      return;
    }

    setProfileData((current) => current
      ? {
          ...current,
          subscription: result.data.subscription,
        }
      : current);
    setCreditDialogOpen(false);
    toast({
      title: t("panelNutritionPrescribeUserProfile.toast.creditSaved"),
      description: result.message,
    });
  };

  const proceedToPrescribe = (nextWeightKg?: string) => {
    if (!profileData) {
      return;
    }

    updatePanelNutritionPrescribeState({
      selectedNutritionPackageId: hasUsableSubscription ? profileData.subscription?.package?.id ?? null : null,
      selectedNutritionPackageName: hasUsableSubscription ? profileData.subscription?.package?.name ?? null : null,
      selectedDietTemplateId: null,
      selectedDietTemplateName: null,
      dietRequestMode: undefined,
      weightKg: nextWeightKg ?? (profileData.profile?.weightKg != null ? String(profileData.profile.weightKg) : undefined),
    });

    if (isProfileIncomplete) {
      setLocation("/panel/nutrition/prescribe/goal");
      return;
    }

    setLocation(hasUsableSubscription ? "/panel/nutrition/prescribe/mode" : "/panel/nutrition/prescribe/packages");
  };

  const handleStartPrescribeClick = () => {
    if (!profileData) {
      return;
    }

    if (profileData.prescriptions.length === 0) {
      proceedToPrescribe();
      return;
    }

    const latestKnownWeight = latestWeight ?? profileData.profile?.weightKg ?? profileData.stats.currentWeightKg ?? null;
    setLatestWeightDraft(latestKnownWeight != null ? String(latestKnownWeight) : "");
    setStartConfirmOpen(true);
  };

  const handleConfirmStartPrescribe = async () => {
    if (!profileData) {
      return;
    }

    const normalizedWeight = latestWeightDraft.trim();
    const numericWeight = Number(normalizedWeight);

    if (!normalizedWeight || Number.isNaN(numericWeight) || numericWeight < 20 || numericWeight > 350) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.invalidLatestWeight"),
        description: t("panelNutritionPrescribeUserProfile.toast.invalidLatestWeightDescription"),
      });
      return;
    }

    const currentProfileWeight = profileData.profile?.weightKg != null ? Number(profileData.profile.weightKg) : null;
    const shouldPersistWeight = currentProfileWeight == null || Math.abs(currentProfileWeight - numericWeight) > 0.001;

    if (!shouldPersistWeight) {
      setStartConfirmOpen(false);
      proceedToPrescribe(normalizedWeight);
      return;
    }

    if (
      !profileData.profile?.dietGoal
      || !profileData.profile?.gender
      || !profileData.profile?.athleteMode
      || !profileData.profile?.activityLevel
      || !profileData.profile?.birthDate
      || profileData.profile.heightCm == null
      || profileData.profile.targetWeightKg == null
    ) {
      setStartConfirmOpen(false);
      proceedToPrescribe(normalizedWeight);
      return;
    }

    setSubmitting(true);
    const result = await api.nutritionAdminUsers.savePrescribeProfile({
      fullName: profileData.user.fullName,
      mobile: profileData.user.mobile,
      dietGoal: profileData.profile.dietGoal as "lose-weight" | "gain-weight" | "maintain-weight",
      gender: profileData.profile.gender as "male" | "female",
      athleteMode: profileData.profile.athleteMode as "athlete" | "non-athlete",
      activityLevel: profileData.profile.activityLevel as "very-low" | "medium" | "high" | "intense",
      birthDate: profileData.profile.birthDate,
      heightCm: profileData.profile.heightCm,
      weightKg: normalizedWeight,
      targetWeightKg: String(profileData.profile.targetWeightKg),
      weeklyWeightChangeKg: profileData.profile.weeklyWeightChangeKg ?? undefined,
      medicalConditions: profileData.profile.medicalConditions ?? undefined,
      medicalConditionsItems: profileData.profile.medicalConditionsItems ?? undefined,
      medicationsAndSupplements: profileData.profile.medicationsAndSupplements ?? undefined,
      foodAllergies: profileData.profile.foodAllergies ?? undefined,
      dislikedFoods: profileData.profile.dislikedFoods ?? undefined,
      mindsetAnswers: profileData.profile.mindsetAnswers ?? {},
    });
    setSubmitting(false);

    if (!result.success) {
      toast({
        variant: "destructive",
        title: t("panelNutritionPrescribeUserProfile.toast.latestWeightSaveFailed"),
        description: result.message,
      });
      return;
    }

    setProfileData((current) => (current ? {
      ...current,
      stats: {
        ...current.stats,
        currentWeightKg: result.data.profile.weightKg ?? current.stats.currentWeightKg ?? null,
      },
      profile: current.profile ? {
        ...current.profile,
        weightKg: result.data.profile.weightKg ?? current.profile.weightKg ?? null,
        targetWeightKg: result.data.profile.targetWeightKg ?? current.profile.targetWeightKg ?? null,
      } : current.profile,
    } : current));

    updatePanelNutritionPrescribeState({
      weightKg: result.data.profile.weightKg != null ? String(result.data.profile.weightKg) : normalizedWeight,
      targetWeightKg: result.data.profile.targetWeightKg != null ? String(result.data.profile.targetWeightKg) : undefined,
    });

    setStartConfirmOpen(false);
    proceedToPrescribe(result.data.profile.weightKg != null ? String(result.data.profile.weightKg) : normalizedWeight);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06131d] text-white" dir={dir}>
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("panelNutritionPrescribeUserProfile.loading")}
        </div>
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  const summaryCards = [
    { title: t("panelNutritionPrescribeUserProfile.summary.startedAt"), value: formatDate(profileData.stats.startedAt), icon: CalendarDays },
    { title: t("panelNutritionPrescribeUserProfile.summary.currentWeight"), value: formatWeight(profileData.stats.currentWeightKg), icon: Scale },
    { title: profileData.stats.weightGapLabel || t("panelNutritionPrescribeUserProfile.summary.weightStatus"), value: formatWeight(profileData.stats.weightGap), icon: Dumbbell },
    { title: t("panelNutritionPrescribeUserProfile.summary.dietsCount"), value: formatNumber(profileData.stats.dietsCount), icon: BadgeCheck },
  ];

  const infoRows = [
    { label: t("panelNutritionPrescribeUserProfile.info.fullName"), value: profileData.user.fullName || "—", icon: UserRound },
    { label: t("panelNutritionPrescribeUserProfile.info.mobile"), value: <PhoneText>{profileData.user.mobile}</PhoneText>, icon: Phone },
    { label: t("panelNutritionPrescribeUserProfile.info.dietGoal"), value: profileData.profile?.dietGoal || "—", icon: Sparkles },
    { label: t("panelNutritionPrescribeUserProfile.info.height"), value: profileData.profile?.heightCm ? t("panelNutritionPrescribeUserProfile.units.cm", { value: formatNumber(profileData.profile.heightCm) }) : "—", icon: Scale },
    { label: t("panelNutritionPrescribeUserProfile.info.targetWeight"), value: formatWeight(profileData.profile?.targetWeightKg), icon: Scale },
    { label: t("panelNutritionPrescribeUserProfile.info.targetPace"), value: profileData.profile?.weeklyWeightChangeKg ? t("panelNutritionPrescribeUserProfile.units.kgPerWeek", { value: formatNumber(profileData.profile.weeklyWeightChangeKg, 1) }) : "—", icon: CalendarDays },
    { label: t("panelNutritionPrescribeUserProfile.info.medicalConditions"), value: <MedicalConditionsSummary items={profileData.profile?.medicalConditionsItems} emptyText="—" />, icon: AlertTriangle },
    { label: t("panelNutritionPrescribeUserProfile.info.medications"), value: profileData.profile?.medicationsAndSupplements?.trim() || "—", icon: Gift },
  ];
  const weightChartData = profileData.prescriptions
    .filter((item) => item.currentWeightKg != null)
    .slice()
    .sort((a, b) => getPrescriptionTime(a) - getPrescriptionTime(b))
    .map((item, index) => ({
      label: formatDate(getPrescriptionDateValue(item)),
      weight: item.currentWeightKg ?? 0,
      targetWeight: item.targetWeightKg ?? profileData.profile?.targetWeightKg ?? null,
      title: item.summaryText || t("panelNutritionPrescribeUserProfile.prescription.fallbackTitle", { number: formatNumber(index + 1) }),
    }));
  const hasWeightChart = weightChartData.length > 0;
  const firstWeight = weightChartData[0]?.weight ?? null;
  const latestWeight = weightChartData.at(-1)?.weight ?? profileData.stats.currentWeightKg ?? null;
  const weightChange = firstWeight != null && latestWeight != null ? Number((latestWeight - firstWeight).toFixed(2)) : null;
  const weightChangeLabel = weightChange == null
    ? "—"
    : weightChange === 0
      ? t("panelNutritionPrescribeUserProfile.weight.noChange")
      : t(weightChange < 0 ? "panelNutritionPrescribeUserProfile.weight.decrease" : "panelNutritionPrescribeUserProfile.weight.increase", { value: formatNumber(Math.abs(weightChange), 1) });
  const missingProfileFields = [
    !(profileData.profile?.dietGoal ?? "").trim() ? t("panelNutritionPrescribeUserProfile.missing.dietGoal") : null,
    !((profileData.profile?.gender ?? profileData.user.gender) || null) ? t("panelNutritionPrescribeUserProfile.missing.gender") : null,
    profileData.profile?.heightCm == null ? t("panelNutritionPrescribeUserProfile.missing.height") : null,
    profileData.profile?.weightKg == null ? t("panelNutritionPrescribeUserProfile.missing.weight") : null,
  ].filter(Boolean) as string[];
  const isProfileIncomplete = missingProfileFields.length > 0;
  const subscriptionEndTime = profileData.subscription?.endsAt ? new Date(profileData.subscription.endsAt).getTime() : Number.NaN;
  const hasValidSubscriptionDate = !profileData.subscription?.endsAt || (!Number.isNaN(subscriptionEndTime) && subscriptionEndTime >= Date.now());
  const hasRemainingDietQuota = (profileData.subscription?.onlineDietRemaining ?? 0) > 0 || (profileData.subscription?.offlineDietRemaining ?? 0) > 0;
  const hasUsableSubscription = Boolean(
    profileData.subscription
    && profileData.subscription.status === "active"
    && hasValidSubscriptionDate
    && hasRemainingDietQuota
    && profileData.subscription.package?.id,
  );
  const activePrescription = profileData.prescriptions.find((item) => item.isCurrent) ?? null;
  const latestPrescription = profileData.prescriptions
    .slice()
    .sort((a, b) => getPrescriptionTime(b) - getPrescriptionTime(a))[0] ?? null;
  const latestRecordedWeight = latestWeight ?? profileData.profile?.weightKg ?? profileData.stats.currentWeightKg ?? null;
  const isValidLatestWeightDraft = (() => {
    const numeric = Number(latestWeightDraft.trim());
    return latestWeightDraft.trim() !== "" && !Number.isNaN(numeric) && numeric >= 20 && numeric <= 350;
  })();

  return (
    <div className="nutrition-user-profile-redesign relative isolate min-h-screen overflow-hidden bg-[#070b12] pb-24 text-white" dir={dir}>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_78%_0%,rgba(245,158,11,0.16),transparent_28%),linear-gradient(180deg,#101018_0%,#070b12_16%,#05070b_100%)]" />
      <header className="border-b border-white/10 bg-[#12131b]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] text-2xl font-black text-slate-950 shadow-2xl shadow-amber-500/25">
              {(profileData.user.fullName || t("panelNutritionPrescribeUserProfile.userInitialFallback")).slice(0, 1)}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                <UserRound className="h-3.5 w-3.5" />
                {t("panelNutritionPrescribeUserProfile.header.badge")}
              </div>
              <h1 className="mt-1.5 text-3xl font-black text-white">{profileData.user.fullName || t("panelNutritionPrescribeUserProfile.header.unnamedUser")}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <PhoneText>{profileData.user.mobile}</PhoneText>
                <Badge className="rounded-xl bg-emerald-500/15 px-3 py-1 text-emerald-200 hover:bg-emerald-500/15">
                  {profileData.user.canBook ? t("panelNutritionPrescribeUserProfile.header.profileOpen") : t("panelNutritionPrescribeUserProfile.header.profileClosed")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
            <Button
              type="button"
              onClick={handleStartPrescribeClick}
              className="h-14 min-w-[210px] rounded-[18px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] px-6 font-black text-slate-950 shadow-2xl shadow-amber-500/20"
            >
              {t("panelNutritionPrescribeUserProfile.actions.startPrescribe")}
              <ForwardArrow className="ms-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-[18px] border-white/12 bg-white/[0.04] px-5 text-white hover:bg-white/[0.08]"
              onClick={() => setPackageDialogOpen(true)}
            >
              <PackagePlus className="me-2 h-4 w-4" />
              {t("panelNutritionPrescribeUserProfile.actions.addPackage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="h-14 rounded-[18px] border-rose-400/35 bg-rose-500/10 px-5 text-rose-100 hover:bg-rose-500/20"
              onClick={() => void handleToggleAccess()}
            >
              {profileData.user.canBook ? <Lock className="me-2 h-4 w-4" /> : <LockOpen className="me-2 h-4 w-4" />}
              {profileData.user.canBook ? t("panelNutritionPrescribeUserProfile.actions.closeProfile") : t("panelNutritionPrescribeUserProfile.actions.openProfile")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title={t("common.back")}
              className="h-11 w-11 rounded-2xl border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              onClick={() => setLocation(backHref)}
            >
              <BackArrow className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-8">

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <div
              key={item.title}
              className="rounded-[20px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.92),rgba(11,22,35,0.86))] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-400">{item.title}</div>
                  <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-amber-400/10 text-amber-300">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {isProfileIncomplete ? (
          <section className="rounded-[32px] border border-rose-300/20 bg-[linear-gradient(160deg,rgba(120,30,30,0.24),rgba(58,18,18,0.88))] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-100">
                  <ShieldAlert className="h-4 w-4" />
                  {t("panelNutritionPrescribeUserProfile.incomplete.title")}
                </div>
                <div className="text-sm leading-7 text-slate-100">
                  {t("panelNutritionPrescribeUserProfile.incomplete.description")}
                  {missingProfileFields.length > 0
                    ? t("panelNutritionPrescribeUserProfile.incomplete.missingList", { fields: missingProfileFields.join("، ") })
                    : ""}
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setLocation("/panel/nutrition/prescribe/goal")}
                className="h-12 rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#f97316)] px-6 font-black text-white"
              >
                {t("panelNutritionPrescribeUserProfile.incomplete.completeInfo")}
                <ForwardArrow className="ms-2 h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xl font-black">{t("panelNutritionPrescribeUserProfile.weightChart.title")}</div>
              <div className="mt-1 text-sm leading-7 text-slate-300">
                {t("panelNutritionPrescribeUserProfile.weightChart.description")}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.weightChart.start")}</div>
                <div className="mt-1 font-black text-white">{formatWeight(firstWeight)}</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.weightChart.latest")}</div>
                <div className="mt-1 font-black text-white">{formatWeight(latestWeight)}</div>
              </div>
              <div className="rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                <div className="text-amber-100/80">{t("panelNutritionPrescribeUserProfile.weightChart.change")}</div>
                <div className="mt-1 font-black text-amber-100">{weightChangeLabel}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[26px] border border-white/10 bg-[#0d1b28] p-4">
            {hasWeightChart ? (
              <ChartContainer
                config={{
                  weight: { label: t("panelNutritionPrescribeUserProfile.weightChart.weight"), color: "#fbbf24" },
                  targetWeight: { label: t("panelNutritionPrescribeUserProfile.weightChart.targetWeight"), color: "#22d3ee" },
                }}
                className="h-[330px] w-full"
              >
                <LineChart data={weightChartData} margin={{ top: 16, right: 12, left: 12, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tickFormatter={(value) => formatNumber(Number(value), 1)}
                  />
                  <ChartTooltip
                    content={(
                      <ChartTooltipContent
                        labelFormatter={(value) => String(value)}
                        formatter={(value, name) => [
                          t("panelNutritionPrescribeUserProfile.units.kg", { value: formatNumber(Number(value), 1) }),
                          name === "targetWeight" ? t("panelNutritionPrescribeUserProfile.weightChart.targetWeight") : t("panelNutritionPrescribeUserProfile.weightChart.weight"),
                        ]}
                      />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-weight)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "var(--color-weight)", strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: "var(--color-weight)", strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="targetWeight"
                    stroke="var(--color-targetWeight)"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] text-center text-sm leading-7 text-slate-300">
                {t("panelNutritionPrescribeUserProfile.weightChart.empty")}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.95),rgba(11,22,35,0.9))] p-6">
            <div className="text-xl font-black">{t("panelNutritionPrescribeUserProfile.info.title")}</div>
            <div className="mt-5 space-y-3">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/5 text-amber-300">
                      <row.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{row.label}</div>
                      <div className="mt-2 font-bold text-white">{row.value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {profileData.subscription ? (
              <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                    <Gift className="h-4 w-4" />
                    {t("panelNutritionPrescribeUserProfile.subscription.title")}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCreditDialog}
                      className="h-9 rounded-[16px] border-emerald-300/25 bg-emerald-500/10 px-4 text-emerald-100 hover:bg-emerald-500/20"
                    >
                      <PackagePlus className="me-2 h-4 w-4" />
                      {t("panelNutritionPrescribeUserProfile.subscription.addCredit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openSubscriptionDateEdit}
                      className="h-9 rounded-[16px] border-emerald-300/25 bg-emerald-500/10 px-4 text-emerald-100 hover:bg-emerald-500/20"
                    >
                      <Pencil className="me-2 h-4 w-4" />
                      {t("panelNutritionPrescribeUserProfile.subscription.editDates")}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-lg font-black text-white">{profileData.subscription.package?.name || t("panelNutritionPrescribeUserProfile.valueUntitled")}</div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-200">
                  <div>{t("panelNutritionPrescribeUserProfile.subscription.onlineRemaining", { count: formatNumber(profileData.subscription.onlineDietRemaining) })}</div>
                  <div>{t("panelNutritionPrescribeUserProfile.subscription.offlineRemaining", { count: formatNumber(profileData.subscription.offlineDietRemaining) })}</div>
                  <div>{t("panelNutritionPrescribeUserProfile.subscription.startsAt", { date: formatDate(profileData.subscription.startsAt) })}</div>
                  <div>{t("panelNutritionPrescribeUserProfile.subscription.endsAt", { date: formatDate(profileData.subscription.endsAt) })}</div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
                {t("panelNutritionPrescribeUserProfile.subscription.emptyPrefix")} <span className="font-bold text-white">{t("panelNutritionPrescribeUserProfile.actions.addPackage")}</span> {t("panelNutritionPrescribeUserProfile.subscription.emptySuffix")}
              </div>
            )}

            <div className="mt-5 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="text-sm font-bold text-amber-200">{t("panelNutritionPrescribeUserProfile.editProfile.title")}</div>
              <div className="mt-2 text-sm leading-7 text-slate-200">
                {t("panelNutritionPrescribeUserProfile.editProfile.description")}
              </div>
              <Button
                type="button"
                onClick={() => setLocation("/panel/nutrition/prescribe/review")}
                className="mt-4 h-11 rounded-[16px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] px-5 font-black text-slate-950"
              >
                <Pencil className="me-2 h-4 w-4" />
                {t("panelNutritionPrescribeUserProfile.editProfile.action")}
              </Button>
            </div>

            <div className="mt-5 rounded-[24px] border border-cyan-300/20 bg-cyan-400/10 p-4">
              <div className="text-sm font-bold text-cyan-100">{t("panelNutritionPrescribeUserProfile.managerMessage.title")}</div>
              <div className="mt-2 text-sm leading-7 text-slate-200">
                {t("panelNutritionPrescribeUserProfile.managerMessage.description")}
              </div>
              <Textarea
                dir={dir}
                value={managerMessageDraft}
                onChange={(event) => setManagerMessageDraft(event.target.value)}
                placeholder={t("panelNutritionPrescribeUserProfile.managerMessage.placeholder")}
                className="mt-4 min-h-[130px] border-white/10 bg-[#0d1b28] text-start leading-8 text-white placeholder:text-slate-500"
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSaveManagerMessage()}
                  className="h-11 rounded-[16px] bg-[linear-gradient(135deg,#06b6d4,#22d3ee)] px-5 font-black text-slate-950"
                >
                  {submitting ? t("common.saving") : t("panelNutritionPrescribeUserProfile.managerMessage.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting || managerMessageDraft.trim() === ""}
                  onClick={() => {
                    const clearedMessage = "";
                    setManagerMessageDraft(clearedMessage);
                    void handleSaveManagerMessage(clearedMessage);
                  }}
                  className="h-11 rounded-[16px] border-rose-300/25 bg-rose-500/10 px-5 text-rose-100 hover:bg-rose-500/20"
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {t("panelNutritionPrescribeUserProfile.managerMessage.delete")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-cyan-300/15 bg-[linear-gradient(160deg,rgba(17,42,58,0.95),rgba(9,24,38,0.9))] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-black">{t("panelNutritionPrescribeUserProfile.activeRequests.title")}</div>
                  <div className="mt-1 text-sm leading-7 text-slate-300">
                    {t("panelNutritionPrescribeUserProfile.activeRequests.description")}
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full border-cyan-300/20 px-3 py-1.5 text-cyan-100">
                  {t("panelNutritionPrescribeUserProfile.activeRequests.count", { count: formatNumber(profileData.activeRequests.length) })}
                </Badge>
              </div>

              <div className="mt-5 space-y-3">
                {profileData.activeRequests.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">
                    {t("panelNutritionPrescribeUserProfile.activeRequests.empty")}
                  </div>
                ) : (
                  profileData.activeRequests.map((item) => {
                    const detailHref = `/panel/nutrition/requests/${item.id}`;
                    const isAiFailed = item.requestType === "ai" && item.aiGenerationStatus === "failed";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLocation(detailHref)}
                        className={`w-full rounded-[26px] border p-4 text-start transition ${
                          isAiFailed
                            ? "border-rose-300/25 bg-[linear-gradient(160deg,rgba(127,29,29,0.24),rgba(46,16,29,0.76))] hover:border-rose-300/40 hover:bg-[linear-gradient(160deg,rgba(127,29,29,0.28),rgba(46,16,29,0.84))]"
                            : "border-cyan-300/10 bg-white/[0.04] hover:border-cyan-300/30 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-full px-3 py-1 text-xs ${isAiFailed ? "bg-rose-500/15 text-rose-100 hover:bg-rose-500/15" : item.requestType === "ai" ? "bg-amber-500/15 text-amber-100 hover:bg-amber-500/15" : "bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/15"}`}>
                                {item.requestTypeLabel}
                              </Badge>
                              <Badge variant="outline" className="rounded-full border-white/15 px-3 py-1 text-xs text-slate-200">
                                {item.statusLabel}
                              </Badge>
                              {item.manualApprovalPending ? (
                                <Badge className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-100 hover:bg-rose-500/15">
                                  {t("panelNutritionPrescribeUserProfile.activeRequests.pendingApproval")}
                                </Badge>
                              ) : null}
                              {item.requestType === "ai" ? (
                                <Badge variant="outline" className="rounded-full border-white/15 px-3 py-1 text-xs text-slate-200">
                                  {item.aiGenerationStatusLabel || t("panelNutritionPrescribeUserProfile.valueMissing")}
                                </Badge>
                              ) : null}
                              {isAiFailed ? (
                                <Badge className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-100 hover:bg-rose-500/15">
                                  {t("panelNutritionPrescribeUserProfile.activeRequests.aiError")}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="max-w-full break-words text-base font-black leading-8 text-white sm:text-lg">
                              {item.requestType === "ai"
                                ? t(
                                  item.dietTemplateName
                                    ? "panelNutritionPrescribeUserProfile.activeRequests.aiForTemplate"
                                    : "panelNutritionPrescribeUserProfile.activeRequests.aiRequest",
                                  { template: item.dietTemplateName ?? "" },
                                )
                                : t("panelNutritionPrescribeUserProfile.activeRequests.expertRequest")}
                            </div>
                            <div className={`max-w-full rounded-[18px] border p-3 text-sm leading-7 ${
                              isAiFailed
                                ? "border-rose-300/20 bg-rose-950/25 text-rose-50"
                                : "border-white/10 bg-[#0d1b28]/70 text-slate-300"
                            }`}>
                              {isAiFailed
                                ? t("panelNutritionPrescribeUserProfile.activeRequests.failedDescription")
                                : item.requestType === "ai"
                                  ? t("panelNutritionPrescribeUserProfile.activeRequests.aiDescription")
                                  : t("panelNutritionPrescribeUserProfile.activeRequests.expertDescription")}
                            </div>
                          </div>
                          <div className="grid min-w-0 grid-cols-3 gap-3 text-center text-sm md:grid-cols-1 xl:grid-cols-3">
                            <div className={`rounded-[18px] border p-3 ${
                              isAiFailed ? "border-rose-300/20 bg-rose-500/10" : "border-cyan-300/20 bg-cyan-400/10"
                            }`}>
                              <div className={isAiFailed ? "text-rose-100/80" : "text-cyan-100/80"}>{t("panelNutritionPrescribeUserProfile.activeRequests.recordedWeight")}</div>
                              <div className={`mt-1 font-bold ${isAiFailed ? "text-rose-100" : "text-cyan-100"}`}>{formatWeight(item.currentWeightKg)}</div>
                            </div>
                            <div className="rounded-[18px] border border-white/10 bg-[#0d1b28] p-3">
                              <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.weightChart.start")}</div>
                              <div className="mt-1 font-bold text-white">{formatDate(item.startedAt)}</div>
                            </div>
                            <div className="rounded-[18px] border border-white/10 bg-[#0d1b28] p-3">
                              <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.activeRequests.createdAt")}</div>
                              <div className="mt-1 font-bold text-white">{formatDate(item.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,34,49,0.98),rgba(8,18,30,0.94))] p-6 shadow-2xl shadow-black/15">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-7 w-1 rounded-full bg-amber-400" />
                  <div>
                  <div className="text-xl font-black">{t("panelNutritionPrescribeUserProfile.prescriptions.title")}</div>
                  <div className="mt-1 text-sm leading-7 text-slate-300">
                    {t("panelNutritionPrescribeUserProfile.prescriptions.description")}
                  </div>
                  </div>
                </div>
                <Badge className="shrink-0 rounded-[14px] border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-amber-100 hover:bg-amber-400/10">
                  {t("panelNutritionPrescribeUserProfile.prescriptions.count", { count: formatNumber(profileData.prescriptions.length) })}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {profileData.prescriptions.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">
                    {t("panelNutritionPrescribeUserProfile.prescriptions.empty")}
                  </div>
                ) : (
                  profileData.prescriptions.map((item) => {
                    const detailHref = item.requestId ? `/panel/nutrition/requests/${item.requestId}` : "";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!detailHref}
                        onClick={() => detailHref && setLocation(detailHref)}
                        className={`group relative w-full overflow-hidden rounded-[24px] border p-4 text-start transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-70 ${
                          item.isCurrent ? "border-emerald-300/25 bg-emerald-500/[0.055]" : "border-white/10 bg-white/[0.04]"
                        }`}
                      >
                        <div className={`absolute inset-y-0 start-0 w-1 ${item.isCurrent ? "bg-emerald-400" : "bg-slate-500"}`} />
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`rounded-[12px] px-3 py-1 text-xs ${item.isCurrent ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15" : "bg-white/10 text-slate-200 hover:bg-white/10"}`}>
                                {item.isCurrent ? t("panelNutritionPrescribeUserProfile.prescriptions.current") : t("panelNutritionPrescribeUserProfile.prescriptions.previous")}
                              </Badge>
                              <Badge variant="outline" className="rounded-[12px] border-white/15 px-3 py-1 text-xs text-slate-200">
                                {getPrescriptionModeLabel(item.prescriptionMode, t)}
                              </Badge>
                              {detailHref ? (
                                <span className="rounded-[12px] border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-100 opacity-0 transition group-hover:opacity-100">
                                  {t("panelNutritionPrescribeUserProfile.prescriptions.viewCase")}
                                </span>
                              ) : null}
                            </div>
                            <div className="max-w-full break-words text-base font-black leading-7 text-white">
                              {item.summaryText || t("panelNutritionPrescribeUserProfile.prescriptions.numberedTitle", { id: item.id })}
                            </div>
                            <div className="max-w-full rounded-[16px] border border-white/10 bg-[#0b1622]/85 p-3 text-sm leading-7 text-slate-300">
                              {item.notes || t("panelNutritionPrescribeUserProfile.prescriptions.notesFallback")}
                            </div>
                          </div>
                          <div className="grid min-w-0 grid-cols-3 gap-2 text-center text-sm md:grid-cols-1 xl:grid-cols-3">
                            <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 p-3">
                              <div className="text-amber-100/80">{t("panelNutritionPrescribeUserProfile.prescriptions.dietWeight")}</div>
                              <div className="mt-1 font-bold text-amber-100">{formatWeight(item.currentWeightKg)}</div>
                            </div>
                            <div className="rounded-[16px] border border-white/10 bg-[#0b1622] p-3">
                              <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.weightChart.start")}</div>
                              <div className="mt-1 font-bold text-white">{formatDate(item.startedAt)}</div>
                            </div>
                            <div className="rounded-[16px] border border-white/10 bg-[#0b1622] p-3">
                              <div className="text-slate-400">{t("panelNutritionPrescribeUserProfile.prescriptions.endsAt")}</div>
                              <div className="mt-1 font-bold text-white">{formatDate(item.endsAt)}</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={Boolean(subscriptionDateDraft)} onOpenChange={(open) => {
        if (!open) {
          setSubscriptionDateDraft(null);
        }
      }}>
        <DialogContent dir={dir} className="border-white/10 bg-[#0d1722] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-start text-xl font-black">{t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.title")}</DialogTitle>
            <DialogDescription className="text-start leading-7 text-slate-300">
              {t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.description")}
            </DialogDescription>
          </DialogHeader>

          {subscriptionDateDraft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-200">{t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.startsAt")}</div>
                <DatePicker
                  value={subscriptionDateDraft.startsAt ? toSafeGregorianDate(subscriptionDateDraft.startsAt) : undefined}
                  onChange={(value) => {
                    const date = value as DateObject | null;
                    if (!date) {
                      return;
                    }

                    setSubscriptionDateDraft((current) => current ? {
                      ...current,
                      startsAt: format(date.toDate(), "yyyy-MM-dd"),
                    } : current);
                  }}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  className="bg-card w-full"
                  inputClass="bg-[#0d1b28] border border-white/10 rounded-[16px] p-3 w-full text-center text-white"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-200">{t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.endsAt")}</div>
                <DatePicker
                  value={subscriptionDateDraft.endsAt ? toSafeGregorianDate(subscriptionDateDraft.endsAt) : undefined}
                  onChange={(value) => {
                    const date = value as DateObject | null;
                    if (!date) {
                      return;
                    }

                    setSubscriptionDateDraft((current) => current ? {
                      ...current,
                      endsAt: format(date.toDate(), "yyyy-MM-dd"),
                    } : current);
                  }}
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYY/MM/DD"
                  className="bg-card w-full"
                  inputClass="bg-[#0d1b28] border border-white/10 rounded-[16px] p-3 w-full text-center text-white"
                />
              </div>
              {!isSubscriptionDateDraftValid ? (
                <div className="rounded-[18px] border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 sm:col-span-2">
                  {t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.invalidRange")}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setSubscriptionDateDraft(null)}
              className="h-11 rounded-[16px] border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={submitting || !isSubscriptionDateDraftValid}
              onClick={() => void handleSaveSubscriptionDates()}
              className="h-11 rounded-[16px] bg-[linear-gradient(135deg,#10b981,#34d399)] px-5 font-black text-slate-950"
            >
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="me-2 h-4 w-4" />}
              {t("panelNutritionPrescribeUserProfile.subscriptionDateDialog.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent dir={dir} className="border-white/10 bg-[#0d1722] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-start text-xl font-black">{t("panelNutritionPrescribeUserProfile.creditDialog.title")}</DialogTitle>
            <DialogDescription className="text-start leading-7 text-slate-300">
              {t("panelNutritionPrescribeUserProfile.creditDialog.description")}
            </DialogDescription>
          </DialogHeader>

          {profileData.subscription ? (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="text-sm text-emerald-100/80">{t("panelNutritionPrescribeUserProfile.creditDialog.activePackage")}</div>
                <div className="mt-2 text-lg font-black text-white">{profileData.subscription.package?.name || t("panelNutritionPrescribeUserProfile.valueUntitled")}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-white/10 bg-[#0d1b28] p-3">
                    <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.onlineRemaining")}</div>
                    <div className="mt-1 font-black text-white">
                      {t("panelNutritionPrescribeUserProfile.creditDialog.remainingOfTotal", {
                        remaining: formatNumber(profileData.subscription.onlineDietRemaining),
                        total: formatNumber(profileData.subscription.onlineDietTotal),
                      })}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-[#0d1b28] p-3">
                    <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.offlineRemaining")}</div>
                    <div className="mt-1 font-black text-white">
                      {t("panelNutritionPrescribeUserProfile.creditDialog.remainingOfTotal", {
                        remaining: formatNumber(profileData.subscription.offlineDietRemaining),
                        total: formatNumber(profileData.subscription.offlineDietTotal),
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-200">{t("panelNutritionPrescribeUserProfile.creditDialog.onlineDelta")}</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={creditDraft.onlineDietDelta}
                    onChange={(event) => setCreditDraft((current) => ({ ...current, onlineDietDelta: event.target.value }))}
                    className="h-12 rounded-[16px] border-white/10 bg-[#0d1b28] text-center text-lg font-black text-white"
                  />
                  <div className="text-xs leading-6 text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.onlineDeltaHint")}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-200">{t("panelNutritionPrescribeUserProfile.creditDialog.offlineDelta")}</div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={creditDraft.offlineDietDelta}
                    onChange={(event) => setCreditDraft((current) => ({ ...current, offlineDietDelta: event.target.value }))}
                    className="h-12 rounded-[16px] border-white/10 bg-[#0d1b28] text-center text-lg font-black text-white"
                  />
                  <div className="text-xs leading-6 text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.offlineDeltaHint")}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.onlineAfterSave")}</div>
                  <div className="mt-1 font-black text-white">
                    {formatNumber(Math.max(0, profileData.subscription.onlineDietRemaining + (Number.isFinite(onlineDietDelta) ? onlineDietDelta : 0)))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.creditDialog.offlineAfterSave")}</div>
                  <div className="mt-1 font-black text-white">
                    {formatNumber(Math.max(0, profileData.subscription.offlineDietRemaining + (Number.isFinite(offlineDietDelta) ? offlineDietDelta : 0)))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold text-slate-200">{t("panelNutritionPrescribeUserProfile.creditDialog.notes")}</div>
                <Textarea
                  value={creditDraft.notes}
                  onChange={(event) => setCreditDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={t("panelNutritionPrescribeUserProfile.creditDialog.notesPlaceholder")}
                  className="min-h-[110px] border-white/10 bg-[#0d1b28] text-start leading-8 text-white placeholder:text-slate-500"
                />
              </div>

              {!hasValidCreditDraft ? (
                <div className="rounded-[18px] border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {t("panelNutritionPrescribeUserProfile.creditDialog.invalidDelta")}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setCreditDialogOpen(false)}
              className="h-11 rounded-[16px] border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={submitting || !hasValidCreditDraft}
              onClick={() => void handleSaveCredits()}
              className="h-11 rounded-[16px] bg-[linear-gradient(135deg,#10b981,#34d399)] px-5 font-black text-slate-950"
            >
              {submitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="me-2 h-4 w-4" />}
              {t("panelNutritionPrescribeUserProfile.creditDialog.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent dir={dir} className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#0d1722] text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-start text-xl font-black">{t("panelNutritionPrescribeUserProfile.packageDialog.title")}</DialogTitle>
            <DialogDescription className="text-start leading-7 text-slate-300">
              {t("panelNutritionPrescribeUserProfile.packageDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            {packages.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={submitting}
                onClick={() => void handleGrantPackage(item.id)}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-start transition hover:border-amber-300/30 hover:bg-white/[0.06] disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-white">{item.name}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-300">
                      {t("panelNutritionPrescribeUserProfile.packageDialog.packageMeta", {
                        days: formatNumber(item.durationDays),
                        online: formatNumber(item.onlineDietCount),
                        offline: formatNumber(item.offlineDietCount),
                      })}
                    </div>
                  </div>
                  <div className="rounded-[16px] bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-200">
                    {t("panelNutritionPrescribeUserProfile.packageDialog.priceToman", { amount: formatNumber(item.discountedPriceAmount ?? item.priceAmount) })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={startConfirmOpen} onOpenChange={setStartConfirmOpen}>
        <DialogContent dir={dir} className="border-white/10 bg-[#0d1722] text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-start text-xl font-black">{t("panelNutritionPrescribeUserProfile.startDialog.title")}</DialogTitle>
            <DialogDescription className="text-start leading-7 text-slate-300">
              {t("panelNutritionPrescribeUserProfile.startDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {activePrescription ? (
              <div className="rounded-[24px] border border-rose-300/20 bg-rose-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-[16px] bg-rose-400/15 text-rose-200">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-black text-rose-100">{t("panelNutritionPrescribeUserProfile.startDialog.activeDietTitle")}</div>
                    <div className="text-sm leading-7 text-slate-200">
                      {t("panelNutritionPrescribeUserProfile.startDialog.activeDietDescription")}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.startDialog.previousDietType")}</div>
                <div className="mt-2 font-black text-white">{getPrescriptionModeLabel((activePrescription ?? latestPrescription)?.prescriptionMode, t)}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.startDialog.latestWeight")}</div>
                <div className="mt-2 font-black text-white">{formatWeight(latestRecordedWeight)}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.startDialog.previousStart")}</div>
                <div className="mt-2 font-black text-white">{formatDate((activePrescription ?? latestPrescription)?.startedAt ?? profileData.stats.startedAt)}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{t("panelNutritionPrescribeUserProfile.startDialog.previousEnd")}</div>
                <div className="mt-2 font-black text-white">{formatDate((activePrescription ?? latestPrescription)?.endsAt)}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="text-sm font-bold text-amber-100">{t("panelNutritionPrescribeUserProfile.startDialog.newWeight")}</div>
              <div className="mt-2 text-sm leading-7 text-slate-200">
                {t("panelNutritionPrescribeUserProfile.startDialog.newWeightDescription")}
              </div>
              <div className="mt-4">
                <Input
                  value={latestWeightDraft}
                  onChange={(event) => setLatestWeightDraft(normalizeWeightInput(event.target.value))}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder={latestRecordedWeight != null ? String(latestRecordedWeight) : t("panelNutritionPrescribeUserProfile.startDialog.weightPlaceholder")}
                  className="h-14 rounded-[18px] border-white/10 bg-[#0d1b28] text-start text-xl font-black text-white"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setStartConfirmOpen(false)}
                className="h-11 rounded-[16px] border-white/10 bg-white/5 px-5 text-white hover:bg-white/10"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={submitting || !isValidLatestWeightDraft}
                onClick={() => void handleConfirmStartPrescribe()}
                className="h-11 rounded-[16px] bg-[linear-gradient(135deg,#f59e0b,#fbbf24)] px-5 font-black text-slate-950"
              >
                {submitting ? t("panelNutritionPrescribeUserProfile.startDialog.submitting") : t("panelNutritionPrescribeUserProfile.startDialog.confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
