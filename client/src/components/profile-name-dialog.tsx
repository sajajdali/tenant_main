import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { UserProfileForm } from "@/components/user-profile-form";
import { useFormat, useLocale, useT } from "@/i18n/locale";
import {
  buildUserProfilePayload,
  getDefaultRegistrationRequirements,
  getUserProfileFormDefaults,
  normalizeRegistrationRequirements,
  RegistrationRequirements,
  UserProfileFormValues,
  validateUserProfileForm,
} from "@/lib/membership";

interface ProfileNameDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileNameDialog({ isOpen, onClose }: ProfileNameDialogProps) {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const formatValue = useFormat();
  const { dir } = useLocale();
  const [requirements, setRequirements] = useState<RegistrationRequirements>(getDefaultRegistrationRequirements());
  const [form, setForm] = useState<UserProfileFormValues>(getUserProfileFormDefaults());
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfileFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const initializedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedUserRef.current = null;
      return;
    }

    const userKey = user?.id || user?.phone || "guest";
    if (initializedUserRef.current !== userKey) {
      setForm(getUserProfileFormDefaults(user));
      setErrors({});
      initializedUserRef.current = userKey;
    }

    api.payment.getSettings().then((res) => {
      if (res.success) {
        setRequirements(normalizeRegistrationRequirements(res.data.registrationRequirements));
      }
    });

  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateUserProfileForm(form, requirements, {
      t,
      formatNumber: formatValue.number,
    });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    const success = await updateProfile(buildUserProfilePayload(form));
    setSaving(false);

    if (!success) {
      toast({ variant: "destructive", title: t("common.error"), description: t("profile.editFailed") });
      return;
    }

    toast({ title: t("profile.updated") });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir={dir} className="pretty-scrollbar max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("profile.editTitle")}</DialogTitle>
          <DialogDescription>{t("profile.editDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <UserProfileForm form={form} onChange={setForm} requirements={requirements} errors={errors} />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("profile.saveChanges")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
