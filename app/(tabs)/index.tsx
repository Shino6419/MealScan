import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { safeRequest } from '@/utils/safeRequest';
import { ACTIVITY_LABELS, FITNESS_GOAL_LABELS, type ActivityLevel, type FitnessGoal } from '@/utils/nutritionGoals';
import { supabase } from '@/utils/supabase';

type Meal = {
  carbs_g: number | null;
  id: string;
  fat_g: number | null;
  food_name: string;
  calories: number;
  meal_type: string;
  protein_g: number | null;
  eaten_at: string;
};

type DailySummary = {
  summary_date?: string;
  total_calories: number;
  meal_count: number;
  calorie_goal: number;
};

type CalendarDay = {
  date: Date;
  key: string;
  day: number;
  isCurrentMonth: boolean;
};

type ProfileMetrics = {
  activity_level: ActivityLevel | null;
  bmi: number | null;
  bmr_calories: number | null;
  carbs_goal_g: number | null;
  daily_calorie_goal: number | null;
  fat_goal_g: number | null;
  fitness_goal: FitnessGoal | null;
  protein_goal_g: number | null;
  tdee_calories: number | null;
};

const COLORS = {
  primary: '#14B8A6',
  accent: '#38BDF8',
  background: '#F0FDFA',
  text: '#0F172A',
  muted: '#64748B',
  card: '#FFFFFF',
  line: '#CCFBF1',
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MEAL_SECTIONS = [
  { key: 'breakfast', title: 'Bữa sáng', icon: 'sunny-outline' },
  { key: 'lunch', title: 'Bữa trưa', icon: 'restaurant-outline' },
  { key: 'afternoon', title: 'Bữa chiều', icon: 'cafe-outline' },
  { key: 'dinner', title: 'Bữa tối', icon: 'moon-outline' },
] as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date) {
  const target = startOfDay(date);
  const day = target.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(target, diff);
}

function getCalendarDays(visibleMonth: Date) {
  const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayIndex = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
  const firstCalendarDay = addDays(firstDayOfMonth, -mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCalendarDay, index);
    return {
      date,
      key: formatDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
    };
  });
}

function normalizeMealType(mealType: string) {
  return mealType === 'snack' ? 'afternoon' : mealType;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
  });
}

export default function StatsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<DailySummary[]>([]);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [profileMetrics, setProfileMetrics] = useState<ProfileMetrics | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));

  const selectedDateKey = formatDateKey(selectedDate);
  const todayKey = formatDateKey(new Date());
  const weekStart = useMemo(() => getMonday(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        return {
          date,
          key: formatDateKey(date),
          label: WEEKDAY_LABELS[index],
        };
      }),
    [weekStart]
  );
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const realMealTotal = meals.reduce((total, meal) => total + meal.calories, 0);
  const macroTotals = meals.reduce(
    (totals, meal) => ({
      carbs: totals.carbs + (meal.carbs_g ?? 0),
      fat: totals.fat + (meal.fat_g ?? 0),
      protein: totals.protein + (meal.protein_g ?? 0),
    }),
    { carbs: 0, fat: 0, protein: 0 },
  );
  const weeklyTotal =
    weeklySummaries.reduce((total, item) => total + item.total_calories, 0) ||
    realMealTotal;
  const totalCalories = summary?.total_calories ?? realMealTotal;
  const goal = dailyGoal || summary?.calorie_goal || 2000;
  const remainingCalories = Math.max(goal - totalCalories, 0);
  const progress = goal > 0 ? Math.min(totalCalories / goal, 1) : 0;
  const isToday = selectedDateKey === todayKey;

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadDashboard() {
        setIsLoading(true);

        const { data: authData } = await supabase.auth
          .getUser()
          .catch(() => ({ data: { user: null } }));
        const userId = authData.user?.id;

        if (!userId) {
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        const weekEnd = addDays(weekStart, 6);
        const [{ data: profileData }, { data: summaryData }, { data: weeklyData }, { data: mealData }] =
          await Promise.all([
            safeRequest(
              supabase
                .from('profiles')
                .select('daily_calorie_goal, bmi, bmr_calories, tdee_calories, protein_goal_g, fat_goal_g, carbs_goal_g, fitness_goal, activity_level')
                .eq('id', userId)
                .maybeSingle(),
              { data: null },
            ),
            safeRequest(
              supabase
                .from('daily_summaries')
                .select('total_calories, meal_count, calorie_goal')
                .eq('user_id', userId)
                .eq('summary_date', selectedDateKey)
                .maybeSingle(),
              { data: null },
            ),
            safeRequest(
              supabase
                .from('daily_summaries')
                .select('summary_date, total_calories, meal_count, calorie_goal')
                .eq('user_id', userId)
                .gte('summary_date', formatDateKey(weekStart))
                .lte('summary_date', formatDateKey(weekEnd))
                .order('summary_date', { ascending: true }),
              { data: [] },
            ),
            safeRequest(
              supabase
                .from('meals')
                .select('id, food_name, calories, protein_g, fat_g, carbs_g, meal_type, eaten_at')
                .eq('user_id', userId)
                .eq('meal_date', selectedDateKey)
                .order('eaten_at', { ascending: true }),
              { data: [] },
            ),
          ]);

        if (isMounted) {
          setDailyGoal(profileData?.daily_calorie_goal ?? 2000);
          setProfileMetrics((profileData as ProfileMetrics | null) ?? null);
          setSummary(summaryData ?? null);
          setWeeklySummaries(weeklyData ?? []);
          setMeals(mealData ?? []);
          setIsLoading(false);
        }
      }

      loadDashboard();

      return () => {
        isMounted = false;
      };
    }, [selectedDateKey, weekStart])
  );

  function getCaloriesForDate(dateKey: string) {
    return weeklySummaries.find((item) => item.summary_date === dateKey)?.total_calories ?? 0;
  }

  function handleSelectDate(day: CalendarDay) {
    setSelectedDate(day.date);
    setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
  }

  function handleChangeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroStripe} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.kicker}>Meal diary</Text>
            <Text style={styles.title}>Nhật ký calo</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="nutrition-outline" size={26} color={COLORS.primary} />
          </View>
        </View>
        <Text style={styles.subtitle}>Chọn ngày trên lịch và xem từng bữa ăn trong ngày đó.</Text>
      </View>

      <View style={styles.weekStrip}>
        {weekDays.map((day) => {
          const calories = getCaloriesForDate(day.key);
          const isSelected = day.key === selectedDateKey;
          return (
            <Pressable
              key={day.key}
              onPress={() =>
                handleSelectDate({
                  date: day.date,
                  key: day.key,
                  day: day.date.getDate(),
                  isCurrentMonth: true,
                })
              }
              style={[styles.weekDay, isSelected && styles.weekDaySelected]}>
              <Text style={[styles.weekLabel, isSelected && styles.weekTextSelected]}>{day.label}</Text>
              <Text style={[styles.weekDate, isSelected && styles.weekTextSelected]}>
                {day.date.getDate()}
              </Text>
              <Text style={[styles.weekCalories, isSelected && styles.weekTextSelected]}>
                {calories}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryBox}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>{isToday ? 'Hôm nay' : formatDisplayDate(selectedDate)}</Text>
            <Text style={styles.summaryValue}>{totalCalories} kcal</Text>
          </View>
          {isLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="flag-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Mục tiêu</Text>
            <Text style={styles.metricValue}>{goal}</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="battery-half-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Còn lại</Text>
            <Text style={styles.metricValue}>{remainingCalories}</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="restaurant-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Số món</Text>
            <Text style={styles.metricValue}>{summary?.meal_count ?? meals.length}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="pulse-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>BMR</Text>
            <Text style={styles.metricValue}>{profileMetrics?.bmr_calories ?? '--'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>TDEE</Text>
            <Text style={styles.metricValue}>{profileMetrics?.tdee_calories ?? '--'}</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="body-outline" size={18} color={COLORS.primary} />
            <Text style={styles.metricLabel}>BMI</Text>
            <Text style={styles.metricValue}>
              {profileMetrics?.bmi == null ? '--' : Number(profileMetrics.bmi).toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={styles.goalInfoRow}>
          <View style={styles.goalInfoItem}>
            <Text style={styles.goalInfoLabel}>Mục tiêu</Text>
            <Text style={styles.goalInfoValue}>
              {profileMetrics?.fitness_goal
                ? FITNESS_GOAL_LABELS[profileMetrics.fitness_goal]
                : 'Chưa đặt'}
            </Text>
          </View>
          <View style={styles.goalInfoItem}>
            <Text style={styles.goalInfoLabel}>Vận động</Text>
            <Text style={styles.goalInfoValue}>
              {profileMetrics?.activity_level
                ? ACTIVITY_LABELS[profileMetrics.activity_level]
                : 'Chưa đặt'}
            </Text>
          </View>
        </View>

        <View style={styles.macroSection}>
          <Text style={styles.macroSectionTitle}>Dinh dưỡng còn lại</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroCard}>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroValue}>
                {Math.round(macroTotals.protein)} / {profileMetrics?.protein_goal_g ?? '--'}g
              </Text>
              <Text style={styles.macroRemain}>
                Còn {profileMetrics?.protein_goal_g == null ? '--' : Math.max(profileMetrics.protein_goal_g - Math.round(macroTotals.protein), 0)}g
              </Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroValue}>
                {Math.round(macroTotals.fat)} / {profileMetrics?.fat_goal_g ?? '--'}g
              </Text>
              <Text style={styles.macroRemain}>
                Còn {profileMetrics?.fat_goal_g == null ? '--' : Math.max(profileMetrics.fat_goal_g - Math.round(macroTotals.fat), 0)}g
              </Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroLabel}>Carb</Text>
              <Text style={styles.macroValue}>
                {Math.round(macroTotals.carbs)} / {profileMetrics?.carbs_goal_g ?? '--'}g
              </Text>
              <Text style={styles.macroRemain}>
                Còn {profileMetrics?.carbs_goal_g == null ? '--' : Math.max(profileMetrics.carbs_goal_g - Math.round(macroTotals.carbs), 0)}g
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Timeline bữa ăn</Text>
          <Text style={styles.sectionSubtitle}>Tổng tuần này: {weeklyTotal} kcal</Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/manual-meal',
              params: { mealDate: selectedDateKey },
            })
          }
          style={styles.addButton}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Thêm</Text>
        </Pressable>
      </View>

      <View style={styles.timelineCard}>
        {meals.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDecoration}>
              <View style={styles.emptyLine} />
              <Ionicons name="calendar-clear-outline" size={30} color={COLORS.primary} />
              <View style={styles.emptyLine} />
            </View>
            <Text style={styles.emptyTitle}>Chưa có món ăn</Text>
            <Text style={styles.emptyText}>Ngày này chưa có món ăn nào trong lịch sử.</Text>
          </View>
        ) : (
          MEAL_SECTIONS.map((section) => {
            const sectionMeals = meals.filter(
              (meal) => normalizeMealType(meal.meal_type) === section.key,
            );

            return (
              <View key={section.key} style={styles.timelineSection}>
                <View style={styles.timelineMarker}>
                  <View style={styles.timelineIcon}>
                    <Ionicons name={section.icon} size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.timelineLine} />
                </View>

                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{section.title}</Text>
                  {sectionMeals.length === 0 ? (
                    <Text style={styles.timelineEmpty}>Chưa có món</Text>
                  ) : (
                    sectionMeals.map((meal) => (
                      <Pressable
                        key={meal.id}
                        onPress={() => {
                          router.push({
                            pathname: '/meal-detail',
                            params: { id: meal.id },
                          });
                        }}
                        style={styles.mealItem}>
                        <View style={styles.mealInfo}>
                          <Text style={styles.mealName}>{meal.food_name}</Text>
                        </View>
                        <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.calendarBox}>
        <View style={styles.calendarAccent} />
        <View style={styles.calendarHeader}>
          <Pressable onPress={() => handleChangeMonth(-1)} style={styles.monthButton}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonthTitle(visibleMonth)}</Text>
          <Pressable onPress={() => handleChangeMonth(1)} style={styles.monthButton}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.calendarWeekdays}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={styles.calendarWeekdayText}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => {
            const isSelected = day.key === selectedDateKey;
            const isCurrentDay = day.key === todayKey;
            return (
              <Pressable
                key={day.key}
                onPress={() => handleSelectDate(day)}
                style={[
                  styles.calendarDay,
                  !day.isCurrentMonth && styles.calendarDayMuted,
                  isCurrentDay && styles.calendarDayToday,
                  isSelected && styles.calendarDaySelected,
                ]}>
                <Text
                  style={[
                    styles.calendarDayText,
                    !day.isCurrentMonth && styles.calendarDayTextMuted,
                    isSelected && styles.calendarDayTextSelected,
                  ]}>
                  {day.day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.background,
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  heroStripe: {
    backgroundColor: COLORS.accent,
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  weekDay: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  weekDaySelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  weekLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  weekDate: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  weekCalories: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  weekTextSelected: {
    color: '#fff',
  },
  summaryBox: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  summaryTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 220,
  },
  summaryValue: {
    color: COLORS.primary,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 8,
  },
  progressTrack: {
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    height: 10,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    height: '100%',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  metricCard: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  goalInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  goalInfoItem: {
    backgroundColor: '#ECFEFF',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  goalInfoLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  goalInfoValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  macroSection: {
    borderTopColor: COLORS.line,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 14,
  },
  macroSectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  macroCard: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  macroLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  macroValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },
  macroRemain: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  timelineCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  timelineSection: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineMarker: {
    alignItems: 'center',
    width: 34,
  },
  timelineIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  timelineLine: {
    backgroundColor: COLORS.line,
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 18,
  },
  timelineTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  timelineEmpty: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    padding: 12,
  },
  mealItem: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    padding: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  mealCalories: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 22,
  },
  emptyDecoration: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  emptyLine: {
    backgroundColor: COLORS.line,
    height: 2,
    width: 46,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'center',
  },
  calendarBox: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    padding: 16,
  },
  calendarAccent: {
    backgroundColor: COLORS.accent,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  monthTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekdayText: {
    color: COLORS.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  calendarDay: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  calendarDayMuted: {
    opacity: 0.35,
  },
  calendarDayToday: {
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  calendarDayTextMuted: {
    color: COLORS.muted,
  },
  calendarDayTextSelected: {
    color: '#fff',
  },
});
