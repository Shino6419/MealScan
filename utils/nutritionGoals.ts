export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type FitnessGoal = 'weight_loss' | 'weight_gain' | 'maintain' | 'muscle_gain';
export type Gender = 'male' | 'female' | 'other';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const GOAL_ADJUSTMENTS: Record<FitnessGoal, number> = {
  weight_loss: -500,
  weight_gain: 300,
  maintain: 0,
  muscle_gain: 250,
};

const PROTEIN_PER_KG: Record<FitnessGoal, number> = {
  weight_loss: 1.8,
  weight_gain: 1.6,
  maintain: 1.4,
  muscle_gain: 2,
};

const FAT_CALORIE_RATIO: Record<FitnessGoal, number> = {
  weight_loss: 0.25,
  weight_gain: 0.25,
  maintain: 0.27,
  muscle_gain: 0.25,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Ít vận động',
  light: 'Vận động nhẹ',
  moderate: 'Vận động vừa',
  active: 'Vận động nhiều',
};

export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
  weight_loss: 'Giảm cân',
  weight_gain: 'Tăng cân',
  maintain: 'Giữ dáng',
  muscle_gain: 'Tăng cơ',
};

export function calculateBmr({
  age,
  gender,
  heightCm,
  weightKg,
}: {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
}) {
  const genderConstant = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;

  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderConstant);
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel) {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
}

export function calculateCalorieGoal(tdee: number, fitnessGoal: FitnessGoal) {
  const target = tdee + GOAL_ADJUSTMENTS[fitnessGoal];

  return Math.max(1200, Math.round(target));
}

export function calculateMacroGoals({
  calorieGoal,
  fitnessGoal,
  weightKg,
}: {
  calorieGoal: number;
  fitnessGoal: FitnessGoal;
  weightKg: number;
}) {
  const proteinGoalG = Math.round(weightKg * PROTEIN_PER_KG[fitnessGoal]);
  const fatGoalG = Math.round((calorieGoal * FAT_CALORIE_RATIO[fitnessGoal]) / 9);
  const proteinCalories = proteinGoalG * 4;
  const fatCalories = fatGoalG * 9;
  const carbsGoalG = Math.max(0, Math.round((calorieGoal - proteinCalories - fatCalories) / 4));

  return {
    carbsGoalG,
    fatGoalG,
    proteinGoalG,
  };
}

export function calculateNutritionTargets({
  activityLevel,
  age,
  fitnessGoal,
  gender,
  heightCm,
  weightKg,
}: {
  activityLevel: ActivityLevel;
  age: number;
  fitnessGoal: FitnessGoal;
  gender: Gender;
  heightCm: number;
  weightKg: number;
}) {
  const bmr = calculateBmr({ age, gender, heightCm, weightKg });
  const tdee = calculateTdee(bmr, activityLevel);
  const calorieGoal = calculateCalorieGoal(tdee, fitnessGoal);
  const macroGoals = calculateMacroGoals({ calorieGoal, fitnessGoal, weightKg });

  return {
    bmr,
    ...macroGoals,
    calorieGoal,
    tdee,
  };
}
