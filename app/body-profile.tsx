import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeRequest } from '@/utils/safeRequest';
import {
  ACTIVITY_LABELS,
  calculateNutritionTargets,
  type ActivityLevel,
  type FitnessGoal,
  type Gender,
} from '@/utils/nutritionGoals';
import { supabase } from '@/utils/supabase';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam', icon: 'male-outline' },
  { value: 'female', label: 'Nữ', icon: 'female-outline' },
  { value: 'other', label: 'Khác', icon: 'person-outline' },
] as const;

const GOAL_OPTIONS = [
  { value: 'weight_loss', label: 'Giảm cân', icon: 'trending-down-outline' },
  { value: 'weight_gain', label: 'Tăng cân', icon: 'trending-up-outline' },
  { value: 'maintain', label: 'Giữ dáng', icon: 'remove-outline' },
  { value: 'muscle_gain', label: 'Tăng cơ', icon: 'barbell-outline' },
] as const;

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: ACTIVITY_LABELS.sedentary, icon: 'leaf-outline' },
  { value: 'light', label: ACTIVITY_LABELS.light, icon: 'walk-outline' },
  { value: 'moderate', label: ACTIVITY_LABELS.moderate, icon: 'bicycle-outline' },
  { value: 'active', label: ACTIVITY_LABELS.active, icon: 'fitness-outline' },
] as const;

type ProfileBodyData = {
  activity_level: ActivityLevel | null;
  age_years: number | null;
  bmi: number | null;
  bmr_calories: number | null;
  carbs_goal_g: number | null;
  daily_calorie_goal: number | null;
  fat_goal_g: number | null;
  fitness_goal: FitnessGoal | null;
  gender: Gender | null;
  height_cm: number | null;
  protein_goal_g: number | null;
  tdee_calories: number | null;
  weight_kg: number | null;
};

function numberText(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim().replace(',', '.');

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatBmi(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  return value.toFixed(1);
}

function getBmiLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'Chưa đủ dữ liệu';
  if (value < 18.5) return 'Thiếu cân';
  if (value < 23) return 'Cân đối';
  if (value < 25) return 'Hơi cao';
  return 'Cao';
}

export default function BodyProfileScreen() {
  const router = useRouter();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal | null>(null);
  const [savedBmi, setSavedBmi] = useState<number | null>(null);
  const [savedBmr, setSavedBmr] = useState<number | null>(null);
  const [savedTdee, setSavedTdee] = useState<number | null>(null);
  const [savedGoal, setSavedGoal] = useState<number | null>(null);
  const [savedProteinGoal, setSavedProteinGoal] = useState<number | null>(null);
  const [savedFatGoal, setSavedFatGoal] = useState<number | null>(null);
  const [savedCarbsGoal, setSavedCarbsGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const previewBmi = useMemo(() => {
    const heightValue = parseOptionalNumber(height);
    const weightValue = parseOptionalNumber(weight);

    if (
      heightValue == null ||
      weightValue == null ||
      !Number.isFinite(heightValue) ||
      !Number.isFinite(weightValue) ||
      heightValue <= 0
    ) {
      return savedBmi;
    }

    return weightValue / ((heightValue / 100) * (heightValue / 100));
  }, [height, savedBmi, weight]);

  const nutritionPreview = useMemo(() => {
    const ageValue = parseOptionalNumber(age);
    const heightValue = parseOptionalNumber(height);
    const weightValue = parseOptionalNumber(weight);

    if (
      ageValue == null ||
      heightValue == null ||
      weightValue == null ||
      !Number.isFinite(ageValue) ||
      !Number.isFinite(heightValue) ||
      !Number.isFinite(weightValue) ||
      !gender ||
      !fitnessGoal
    ) {
      return {
        bmr: savedBmr,
        carbsGoalG: savedCarbsGoal,
        calorieGoal: savedGoal,
        fatGoalG: savedFatGoal,
        proteinGoalG: savedProteinGoal,
        tdee: savedTdee,
      };
    }

    return calculateNutritionTargets({
      activityLevel,
      age: ageValue,
      fitnessGoal,
      gender,
      heightCm: heightValue,
      weightKg: weightValue,
    });
  }, [
    activityLevel,
    age,
    fitnessGoal,
    gender,
    height,
    savedBmr,
    savedCarbsGoal,
    savedFatGoal,
    savedGoal,
    savedProteinGoal,
    savedTdee,
    weight,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadBodyProfile() {
      setIsLoading(true);

      const { data: authData } = await supabase.auth
        .getUser()
        .catch(() => ({ data: { user: null } }));
      const userId = authData.user?.id;

      if (!userId) {
        if (isMounted) {
          setIsLoading(false);
        }
        router.replace('/login');
        return;
      }

      const { data, error } = await safeRequest(
        supabase
          .from('profiles')
          .select('age_years, gender, height_cm, weight_kg, activity_level, bmi, bmr_calories, tdee_calories, daily_calorie_goal, protein_goal_g, fat_goal_g, carbs_goal_g, fitness_goal')
          .eq('id', userId)
          .maybeSingle(),
        { data: null, error: new Error('Network request failed') },
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        Alert.alert(
          'Không tải được thông tin',
          error.message.includes('age_years')
            ? 'Database chưa có các cột thể trạng. Hãy chạy user_profile_migration.sql trong Supabase.'
            : error.message,
        );
      }

      const profile = data as ProfileBodyData | null;
      setAge(numberText(profile?.age_years));
      setGender(profile?.gender ?? null);
      setHeight(numberText(profile?.height_cm));
      setWeight(numberText(profile?.weight_kg));
      setActivityLevel(profile?.activity_level ?? 'light');
      setSavedBmi(profile?.bmi ?? null);
      setSavedBmr(profile?.bmr_calories ?? null);
      setSavedTdee(profile?.tdee_calories ?? null);
      setSavedGoal(profile?.daily_calorie_goal ?? null);
      setSavedProteinGoal(profile?.protein_goal_g ?? null);
      setSavedFatGoal(profile?.fat_goal_g ?? null);
      setSavedCarbsGoal(profile?.carbs_goal_g ?? null);
      setFitnessGoal(profile?.fitness_goal ?? null);
      setIsLoading(false);
    }

    loadBodyProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSave() {
    const ageValue = parseOptionalNumber(age);
    const heightValue = parseOptionalNumber(height);
    const weightValue = parseOptionalNumber(weight);

    if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 5 || ageValue > 120)) {
      Alert.alert('Tuổi không hợp lệ', 'Vui lòng nhập tuổi từ 5 đến 120.');
      return;
    }

    if (heightValue !== null && (!Number.isFinite(heightValue) || heightValue < 50 || heightValue > 250)) {
      Alert.alert('Chiều cao không hợp lệ', 'Vui lòng nhập chiều cao từ 50 đến 250 cm.');
      return;
    }

    if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue < 10 || weightValue > 400)) {
      Alert.alert('Cân nặng không hợp lệ', 'Vui lòng nhập cân nặng từ 10 đến 400 kg.');
      return;
    }

    if (!fitnessGoal) {
      Alert.alert('Thiếu mục tiêu', 'Vui lòng chọn mục tiêu thể trạng.');
      return;
    }

    if (!gender) {
      Alert.alert('Thiếu giới tính', 'Vui lòng chọn giới tính để tính TDEE.');
      return;
    }

    if (ageValue === null || heightValue === null || weightValue === null) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đủ tuổi, chiều cao và cân nặng để tính TDEE.');
      return;
    }

    const targets = calculateNutritionTargets({
      activityLevel,
      age: ageValue,
      fitnessGoal,
      gender,
      heightCm: heightValue,
      weightKg: weightValue,
    });

    setIsSaving(true);

    const { data: authData } = await supabase.auth
      .getUser()
      .catch(() => ({ data: { user: null } }));
    const userId = authData.user?.id;

    if (!userId) {
      setIsSaving(false);
      router.replace('/login');
      return;
    }

    const { error } = await safeRequest(
      supabase
        .from('profiles')
        .update({
          age_years: ageValue,
          gender,
          height_cm: heightValue,
          weight_kg: weightValue,
          activity_level: activityLevel,
          fitness_goal: fitnessGoal,
          bmr_calories: targets.bmr,
          tdee_calories: targets.tdee,
          daily_calorie_goal: targets.calorieGoal,
          protein_goal_g: targets.proteinGoalG,
          fat_goal_g: targets.fatGoalG,
          carbs_goal_g: targets.carbsGoalG,
        })
        .eq('id', userId),
      { error: new Error('Network request failed') },
    );

    setIsSaving(false);

    if (error) {
      Alert.alert(
        'Lưu thất bại',
        error.message.includes('age_years')
          ? 'Database chưa có các cột thể trạng. Hãy chạy user_profile_migration.sql trong Supabase.'
          : error.message,
      );
      return;
    }

    Alert.alert('Đã lưu', 'Thông tin thể trạng đã được cập nhật.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
          <Text style={styles.backText}>Quay lại</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerStripe} />
          <View style={styles.headerTop}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>User Profile</Text>
              <Text style={styles.title}>Thông tin thể trạng</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="body-outline" size={26} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>
            Dữ liệu này dùng để cá nhân hóa mục tiêu calo và đề xuất món ăn.
          </Text>
        </View>

        <View style={styles.bmiPanel}>
          <View>
            <Text style={styles.bmiLabel}>BMI hiện tại</Text>
            <Text style={styles.bmiValue}>{formatBmi(previewBmi)}</Text>
          </View>
          <View style={styles.bmiBadge}>
            <Text style={styles.bmiBadgeText}>{getBmiLabel(previewBmi)}</Text>
          </View>
        </View>

        <View style={styles.targetPanel}>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>BMR</Text>
            <Text style={styles.targetValue}>{nutritionPreview.bmr ?? '--'}</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>TDEE</Text>
            <Text style={styles.targetValue}>{nutritionPreview.tdee ?? '--'}</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Goal</Text>
            <Text style={styles.targetValue}>{nutritionPreview.calorieGoal ?? '--'}</Text>
          </View>
        </View>

        <View style={styles.targetPanel}>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Protein</Text>
            <Text style={styles.targetValue}>{nutritionPreview.proteinGoalG ?? '--'}g</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Fat</Text>
            <Text style={styles.targetValue}>{nutritionPreview.fatGoalG ?? '--'}g</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Carb</Text>
            <Text style={styles.targetValue}>{nutritionPreview.carbsGoalG ?? '--'}g</Text>
          </View>
        </View>

        <View style={styles.form}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#14B8A6" />
              <Text style={styles.loadingText}>Đang tải thông tin...</Text>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Tuổi</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setAge}
                    placeholder="Ví dụ: 22"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    value={age}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Giới tính</Text>
                <View style={styles.optionGrid}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = gender === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setGender(option.value)}
                        style={[styles.optionButton, selected && styles.optionButtonSelected]}>
                        <Ionicons
                          name={option.icon}
                          size={19}
                          color={selected ? '#FFFFFF' : '#14B8A6'}
                        />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.twoColumn}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Chiều cao</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="resize-outline" size={20} color="#64748B" />
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={setHeight}
                      placeholder="cm"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                      value={height}
                    />
                  </View>
                </View>

                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Cân nặng</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="scale-outline" size={20} color="#64748B" />
                    <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={setWeight}
                      placeholder="kg"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                      value={weight}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Mục tiêu</Text>
                <View style={styles.goalGrid}>
                  {GOAL_OPTIONS.map((option) => {
                    const selected = fitnessGoal === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setFitnessGoal(option.value)}
                        style={[styles.goalButton, selected && styles.optionButtonSelected]}>
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={selected ? '#FFFFFF' : '#14B8A6'}
                        />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Mức vận động</Text>
                <View style={styles.goalGrid}>
                  {ACTIVITY_OPTIONS.map((option) => {
                    const selected = activityLevel === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setActivityLevel(option.value)}
                        style={[styles.goalButton, selected && styles.optionButtonSelected]}>
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={selected ? '#FFFFFF' : '#14B8A6'}
                        />
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                disabled={isSaving}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  isSaving && styles.primaryButtonDisabled,
                  pressed && !isSaving && styles.primaryButtonPressed,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Lưu thông tin</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F0FDFA',
    flex: 1,
  },
  container: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 36,
  },
  backText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  headerStripe: {
    backgroundColor: '#38BDF8',
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  kicker: {
    color: '#14B8A6',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  bmiPanel: {
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 94,
    padding: 16,
  },
  bmiLabel: {
    color: '#CCFBF1',
    fontSize: 13,
    fontWeight: '800',
  },
  bmiValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  bmiBadge: {
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bmiBadgeText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '900',
  },
  targetPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  targetItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  targetLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  targetValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 14,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 180,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    gap: 8,
  },
  fieldHalf: {
    flex: 1,
    gap: 8,
  },
  label: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  input: {
    color: '#0F172A',
    flex: 1,
    fontSize: 16,
    minHeight: 52,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  optionText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  goalGrid: {
    gap: 8,
  },
  goalButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryButtonDisabled: {
    opacity: 0.68,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
