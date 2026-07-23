import { api } from "@/lib/api";
import { hasNutritionProfileHomeAccess } from "@/nutrition/lib/profile-completion";

export async function resolveNutritionStartPath() {
  const result = await api.nutrition.getProfile();

  if (result.success && hasNutritionProfileHomeAccess(result.data.profile)) {
    return "/nutrition/profile";
  }

  return "/nutrition/membership/goal";
}
