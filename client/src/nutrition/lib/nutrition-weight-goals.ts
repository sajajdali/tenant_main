import { NutritionDietGoal, NutritionGender } from "@/nutrition/lib/nutrition-form-state";

const round2 = (value: number) => Math.round(value * 100) / 100;
const roundToHalf = (value: number) => Math.round(value * 2) / 2;

export function calculateNutritionWeightGoals({
  heightCm,
  gender,
  currentWeightKg,
  dietGoal,
}: {
  heightCm: number;
  gender: NutritionGender;
  currentWeightKg: number;
  dietGoal: NutritionDietGoal;
}) {
  const heightMeters = heightCm / 100;
  const healthyMinWeightKg = round2(18.5 * heightMeters * heightMeters);
  const healthyMaxWeightKg = round2(24.9 * heightMeters * heightMeters);

  const heightInches = heightCm / 2.54;
  const inchesOverFiveFeet = Math.max(heightInches - 60, 0);
  const devineIdealWeightKg = gender === "male"
    ? 50 + (2.3 * inchesOverFiveFeet)
    : 45.5 + (2.3 * inchesOverFiveFeet);

  const idealWeightKg = roundToHalf(Math.min(Math.max(devineIdealWeightKg, healthyMinWeightKg), healthyMaxWeightKg));

  const healthWeightKg = roundToHalf((healthyMinWeightKg + healthyMaxWeightKg) / 2);
  let recommendedTargetWeightKg = healthWeightKg;

  if (dietGoal === "lose-weight") {
    recommendedTargetWeightKg = currentWeightKg > healthyMaxWeightKg
      ? healthyMaxWeightKg
      : Math.max(healthyMinWeightKg, Math.min(currentWeightKg, healthyMaxWeightKg));
  } else if (dietGoal === "gain-weight") {
    recommendedTargetWeightKg = currentWeightKg < healthyMinWeightKg
      ? healthyMinWeightKg
      : Math.min(healthyMaxWeightKg, Math.max(currentWeightKg, healthyMinWeightKg));
  } else {
    recommendedTargetWeightKg = Math.min(healthyMaxWeightKg, Math.max(currentWeightKg, healthyMinWeightKg));
  }

  return {
    healthyMinWeightKg,
    healthyMaxWeightKg,
    idealWeightKg,
    recommendedTargetWeightKg: roundToHalf(recommendedTargetWeightKg),
  };
}
