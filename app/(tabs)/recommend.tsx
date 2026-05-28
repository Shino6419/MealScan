import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '@/utils/supabase';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

type ProfileGoals = {
  carbs_goal_g: number | null;
  daily_calorie_goal: number | null;
  fat_goal_g: number | null;
  fitness_goal: string | null;
  protein_goal_g: number | null;
};

type Meal = {
  calories: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  food_name: string;
  protein_g: number | null;
};

type RecommendedFood = {
  calories: number;
  carbs_g: number;
  diet_tags: string | null;
  fat_g: number;
  food_name: string;
  meal_tags: string | null;
  protein_g: number;
  serving: string;
};

type NutritionContext = {
  fitnessGoal: string | null;
  foods: RecommendedFood[];
  goals: {
    calories: number;
    carbs: number | null;
    fat: number | null;
    protein: number | null;
  };
  remaining: {
    calories: number;
    carbs: number | null;
    fat: number | null;
    protein: number | null;
  };
  totals: {
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
  };
};

type ScreenMode = 'rulebase' | 'chat';

type RuleMeal = 'breakfast' | 'lunch' | 'afternoon' | 'dinner';

type RuleCondition = 'balanced' | 'high_carb' | 'high_protein' | 'low_calorie' | null;

type RuleRecommendation = RecommendedFood & {
  reason: string;
  score: number;
};

type RecommendMealsResponse = {
  error?: string;
  message?: string;
  model?: string;
  reply?: string;
};

type FunctionInvokeError = Error & {
  context?: {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };
};

const QUICK_PROMPTS = [
  'Gợi ý bữa sáng',
  'Gợi ý bữa trưa',
  'Gợi ý bữa chiều',
  'Gợi ý bữa tối',
];

const RULE_MEALS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: RuleMeal }[] = [
  { icon: 'sunny-outline', label: 'Bữa sáng', value: 'breakfast' },
  { icon: 'restaurant-outline', label: 'Bữa trưa', value: 'lunch' },
  { icon: 'cafe-outline', label: 'Bữa chiều', value: 'afternoon' },
  { icon: 'moon-outline', label: 'Bữa tối', value: 'dinner' },
];

const RULE_CONDITIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: RuleCondition }[] = [
  { icon: 'leaf-outline', label: 'Ít calo', value: 'low_calorie' },
  { icon: 'barbell-outline', label: 'Giàu protein', value: 'high_protein' },
  { icon: 'flash-outline', label: 'Thêm carb', value: 'high_carb' },
  { icon: 'scale-outline', label: 'Cân bằng', value: 'balanced' },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Bạn muốn mình đề xuất món theo mục tiêu nào hôm nay? Mình có thể dựa trên calo còn lại, protein, fat, carb và các bữa đã ăn.',
  },
];

function getCurrentMealType() {
  const hour = new Date().getHours();

  if (hour >= 4 && hour < 10) {
    return 'breakfast';
  }

  if (hour < 14) {
    return 'lunch';
  }

  if (hour < 18) {
    return 'afternoon';
  }

  return 'dinner';
}

function getMealTypeLabel(mealType: string) {
  const labels: Record<string, string> = {
    afternoon: 'bữa chiều',
    breakfast: 'bữa sáng',
    dinner: 'bữa tối',
    lunch: 'bữa trưa',
  };

  return labels[mealType] ?? 'bữa hiện tại';
}

function getTags(value: string | null) {
  return (value ?? '').split('|').filter(Boolean);
}

function getGoalTags(goal: string | null) {
  if (goal === 'weight_loss') {
    return ['low_calorie', 'low_fat', 'high_protein'];
  }

  if (goal === 'muscle_gain') {
    return ['high_protein', 'balanced'];
  }

  if (goal === 'weight_gain') {
    return ['high_calorie', 'high_protein', 'high_carb', 'balanced'];
  }

  return ['balanced'];
}

function getFoodFamily(foodName: string) {
  const name = foodName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  const families = ['bun', 'pho', 'com', 'chao', 'mi', 'banh', 'goi', 'sup', 'lau', 'tom', 'ca', 'ga', 'bo', 'trung'];

  return families.find((family) => name.includes(family)) ?? name.split(' ')[0] ?? name;
}

function getMacroFitScore(food: RecommendedFood, remaining: NutritionContext['remaining']) {
  let score = 0;

  if ((remaining.protein ?? 0) > 20) {
    score += Math.min(food.protein_g, remaining.protein ?? food.protein_g) * 1.5;
  }

  if ((remaining.carbs ?? 0) > 45) {
    score += Math.min(food.carbs_g, remaining.carbs ?? food.carbs_g) * 0.35;
  }

  if ((remaining.fat ?? 0) < 15) {
    score -= food.fat_g * 1.2;
  }

  return score;
}

function getRuleReason(food: RecommendedFood, matchedTags: string[], mealType: string, condition: RuleCondition) {
  const dietTags = getTags(food.diet_tags);

  if (condition === 'low_calorie') {
    return food.calories <= 220 || dietTags.includes('low_calorie')
      ? 'Ít calo, dễ kiểm soát năng lượng'
      : 'Nhẹ năng lượng hơn các lựa chọn khác';
  }

  if (condition === 'high_protein') {
    return 'Bổ sung protein tốt';
  }

  if (condition === 'high_carb') {
    return 'Bổ sung carb cho năng lượng còn lại';
  }

  if (condition === 'balanced') {
    return 'Cân bằng cho bữa này';
  }

  if (matchedTags.includes('high_protein')) {
    return 'Bổ sung protein tốt';
  }

  if (matchedTags.includes('low_calorie')) {
    return 'Ít calo, dễ kiểm soát năng lượng';
  }

  if (matchedTags.includes('high_carb')) {
    return 'Bổ sung carb cho năng lượng còn lại';
  }

  if (dietTags.includes('balanced')) {
    return 'Cân bằng cho bữa này';
  }

  return `Hợp ${getMealTypeLabel(mealType)}`;
}

function diversifyRecommendations(items: RuleRecommendation[], offset: number, limit = 20) {
  const rotated = items.slice(offset).concat(items.slice(0, offset));
  const selected: RuleRecommendation[] = [];
  const usedFamilies = new Set<string>();

  for (const item of rotated) {
    const family = getFoodFamily(item.food_name);

    if (usedFamilies.has(family) && selected.length < Math.ceil(limit / 2)) {
      continue;
    }

    selected.push(item);
    usedFamilies.add(family);

    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const item of rotated) {
    if (!selected.some((selectedItem) => selectedItem.food_name === item.food_name && selectedItem.serving === item.serving)) {
      selected.push(item);
    }

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function buildRuleRecommendations(
  context: NutritionContext,
  mealType: RuleMeal,
  condition: RuleCondition,
  shuffleSeed: number,
): RuleRecommendation[] {
  const goalTags = getGoalTags(context.fitnessGoal);
  const remaining = context.remaining;
  const preferredTags = [
    ...goalTags,
    ...(remaining.protein != null && remaining.protein > 20 ? ['high_protein'] : []),
    ...(remaining.carbs != null && remaining.carbs > 45 ? ['high_carb', 'balanced'] : []),
    ...(remaining.fat != null && remaining.fat < 12 ? ['low_fat'] : []),
    ...(condition === 'low_calorie' ? ['low_calorie', 'low_fat'] : []),
    ...(condition === 'high_protein' ? ['high_protein'] : []),
    ...(condition === 'high_carb' ? ['high_carb'] : []),
    ...(condition === 'balanced' || condition == null ? ['balanced'] : []),
  ];
  const calorieTarget = Math.max(Math.min((remaining.calories || 1500) * 0.3, 650), 250);
  const calorieLimit =
    condition === 'low_calorie'
      ? 260
      : remaining.calories > 0
        ? Math.max(Math.min(remaining.calories + 220, 1100), 220)
        : 700;
  const mealMatchedFoods = context.foods.filter((food) => getTags(food.meal_tags).includes(mealType));
  const sourceFoods = mealMatchedFoods.length >= 12 ? mealMatchedFoods : context.foods;

  const scoredFoods = sourceFoods
    .filter((food) => food.calories <= calorieLimit)
    .map((food) => {
      const dietTags = getTags(food.diet_tags);
      const mealTags = getTags(food.meal_tags);
      const matchedTags = preferredTags.filter((tag) => dietTags.includes(tag));
      let score = 100;
      score -= Math.abs(food.calories - calorieTarget) / 12;
      score += matchedTags.length * 22;
      score += condition === 'low_calorie' ? 0 : getMacroFitScore(food, remaining);
      score += mealTags.includes(mealType) ? 28 : 0;
      score += dietTags.includes('balanced') ? 10 : 0;
      score += condition !== 'low_calorie' && dietTags.includes('high_protein') && (remaining.protein ?? 0) > 20 ? 16 : 0;
      score += dietTags.includes('low_calorie') ? 8 : 0;
      score += condition === 'low_calorie' ? Math.max(260 - food.calories, 0) * 0.45 : 0;
      score += condition === 'low_calorie' && dietTags.includes('low_calorie') ? 45 : 0;
      score -= condition === 'low_calorie' && food.calories > 220 ? (food.calories - 220) * 0.9 : 0;
      score += condition === 'high_protein' && dietTags.includes('high_protein') ? 34 : 0;
      score += condition === 'high_carb' && dietTags.includes('high_carb') ? 30 : 0;
      score += condition === 'balanced' && dietTags.includes('balanced') ? 32 : 0;

      const reason = getRuleReason(food, matchedTags, mealType, condition);

      return { ...food, reason, score };
    })
    .sort((first, second) => second.score - first.score);

  return diversifyRecommendations(scoredFoods, shuffleSeed % Math.max(scoredFoods.length, 1));
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function requestRemoteRecommendation(message: string) {
  const { data, error } = await supabase.functions.invoke<RecommendMealsResponse>('recommend-meals', {
    body: { message },
  });

  if (error) {
    const invokeError = error as FunctionInvokeError;
    const errorBody = await invokeError.context?.json?.().catch(() => null);

    if (errorBody && typeof errorBody === 'object') {
      const body = errorBody as RecommendMealsResponse;
      throw new Error(body.message || body.error || invokeError.message);
    }

    throw invokeError;
  }

  if (!data?.reply) {
    throw new Error(data?.message || data?.error || 'Recommend function returned an empty reply.');
  }

  return data.reply;
}

export default function RecommendScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<ScreenMode>('rulebase');
  const [ruleMeal, setRuleMeal] = useState<RuleMeal>(() => getCurrentMealType());
  const [ruleCondition, setRuleCondition] = useState<RuleCondition>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<NutritionContext | null>(null);

  const goalCards = useMemo(
    () => [
      { label: 'Calo còn lại', value: context ? `${context.remaining.calories} kcal` : '-- kcal' },
      { label: 'Protein', value: context?.remaining.protein == null ? '--g' : `${context.remaining.protein}g` },
      { label: 'Carb', value: context?.remaining.carbs == null ? '--g' : `${context.remaining.carbs}g` },
    ],
    [context],
  );
  const ruleRecommendations = useMemo(
    () => (context ? buildRuleRecommendations(context, ruleMeal, ruleCondition, shuffleSeed) : []),
    [context, ruleMeal, ruleCondition, shuffleSeed],
  );

  const loadNutritionContext = useCallback(async () => {
    const { data: authData } = await supabase.auth
      .getUser()
      .catch(() => ({ data: { user: null } }));
    const userId = authData.user?.id;

    if (!userId) {
      return null;
    }

    const todayKey = formatDateKey(new Date());
    const [{ data: profile }, { data: meals }, { data: foods }] = await Promise.all([
      safeRequest(
        supabase
          .from('profiles')
          .select('daily_calorie_goal, protein_goal_g, fat_goal_g, carbs_goal_g, fitness_goal')
          .eq('id', userId)
          .maybeSingle(),
        { data: null },
      ),
      safeRequest(
        supabase
          .from('meals')
          .select('food_name, calories, protein_g, fat_g, carbs_g')
          .eq('user_id', userId)
          .eq('meal_date', todayKey),
        { data: [] },
      ),
      safeRequest(
        supabase
          .from('recommended_foods')
          .select('food_name, serving, calories, protein_g, fat_g, carbs_g, meal_tags, diet_tags')
          .eq('is_active', true)
          .order('food_name', { ascending: true })
          .limit(500),
        { data: [] },
      ),
    ]);

    const profileGoals = profile as ProfileGoals | null;
    const todayMeals = (meals ?? []) as Meal[];
    const recommendedFoods = (foods ?? []) as RecommendedFood[];
    const totals = todayMeals.reduce(
      (current, meal) => ({
        calories: current.calories + (meal.calories ?? 0),
        carbs: current.carbs + (meal.carbs_g ?? 0),
        fat: current.fat + (meal.fat_g ?? 0),
        protein: current.protein + (meal.protein_g ?? 0),
      }),
      { calories: 0, carbs: 0, fat: 0, protein: 0 },
    );
    const goals = {
      calories: profileGoals?.daily_calorie_goal ?? 2000,
      carbs: profileGoals?.carbs_goal_g ?? null,
      fat: profileGoals?.fat_goal_g ?? null,
      protein: profileGoals?.protein_goal_g ?? null,
    };
    const nextContext = {
      fitnessGoal: profileGoals?.fitness_goal ?? null,
      foods: recommendedFoods,
      goals,
      remaining: {
        calories: Math.max(goals.calories - totals.calories, 0),
        carbs: goals.carbs == null ? null : Math.max(Math.round(goals.carbs - totals.carbs), 0),
        fat: goals.fat == null ? null : Math.max(Math.round(goals.fat - totals.fat), 0),
        protein: goals.protein == null ? null : Math.max(Math.round(goals.protein - totals.protein), 0),
      },
      totals,
    };

    setContext(nextContext);
    return nextContext;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNutritionContext();
    }, [loadNutritionContext]),
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  async function sendMessage(text: string) {
    const trimmedText = text.trim();

    if (!trimmedText || isLoading) {
      return;
    }

    setInput('');
    setIsLoading(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text: trimmedText },
    ]);

    try {
      await loadNutritionContext();
      const reply = await requestRemoteRecommendation(trimmedText);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: reply },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'không rõ lỗi';
      console.warn('recommend-meals Gemini error:', message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: `Mình chưa gọi được Gemini.\nLỗi: ${message}\n\nMình đã tắt fallback offline để mình và bạn nhìn đúng lỗi thật.`,
        },
      ]);
    }
    setIsLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Recommendation</Text>
            <Text style={styles.title}>Đề xuất món ăn</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubbles-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>
          Chat với MealScan để chọn món hợp mục tiêu dinh dưỡng.
        </Text>
      </View>

      <View style={styles.goalCard}>
        {goalCards.map((card) => (
          <View key={card.label} style={styles.goalItem}>
            <Text style={styles.goalLabel}>{card.label}</Text>
            <Text style={styles.goalValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('rulebase')}
          style={[styles.modeButton, mode === 'rulebase' && styles.modeButtonActive]}>
          <Ionicons
            name="options-outline"
            size={16}
            color={mode === 'rulebase' ? '#FFFFFF' : '#0F766E'}
          />
          <Text style={[styles.modeText, mode === 'rulebase' && styles.modeTextActive]}>
            Rule-based
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('chat')}
          style={[styles.modeButton, mode === 'chat' && styles.modeButtonActive]}>
          <Ionicons
            name="chatbubbles-outline"
            size={16}
            color={mode === 'chat' ? '#FFFFFF' : '#0F766E'}
          />
          <Text style={[styles.modeText, mode === 'chat' && styles.modeTextActive]}>
            Chat
          </Text>
        </Pressable>
      </View>

      {mode === 'rulebase' ? (
        <ScrollView contentContainerStyle={styles.ruleList} showsVerticalScrollIndicator={false}>
          <View style={styles.ruleIntro}>
            <View style={styles.ruleIntroTop}>
              <View style={styles.ruleIntroCopy}>
                <Text style={styles.ruleTitle}>Gợi ý theo dữ liệu hôm nay</Text>
                <Text style={styles.ruleText}>
                  Dựa trên {getMealTypeLabel(getCurrentMealType())}, calo còn lại, macro còn thiếu và tag món ăn trong database.
                </Text>
              </View>
              <Pressable onPress={() => setShuffleSeed((current) => current + 1)} style={styles.refreshButton}>
                <Ionicons name="shuffle-outline" size={18} color="#0F766E" />
              </Pressable>
            </View>
          </View>

          <View style={styles.ruleMealRow}>
            {RULE_MEALS.map((meal) => {
              const isSelected = ruleMeal === meal.value;

              return (
                <Pressable
                  key={meal.value}
                  onPress={() => setRuleMeal(meal.value)}
                  style={[styles.ruleFilterButton, isSelected && styles.ruleFilterButtonActive]}>
                  <Ionicons
                    name={meal.icon}
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#0F766E'}
                  />
                  <Text style={[styles.ruleFilterText, isSelected && styles.ruleFilterTextActive]}>
                    {meal.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.ruleFilterGrid}>
            {RULE_CONDITIONS.map((condition) => {
              const isSelected = ruleCondition === condition.value;

              return (
                <Pressable
                  key={condition.value}
                  onPress={() =>
                    setRuleCondition((current) =>
                      current === condition.value ? null : condition.value,
                    )
                  }
                  style={[styles.ruleFilterButton, isSelected && styles.ruleFilterButtonActive]}>
                  <Ionicons
                    name={condition.icon}
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#0F766E'}
                  />
                  <Text style={[styles.ruleFilterText, isSelected && styles.ruleFilterTextActive]}>
                    {condition.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShuffleSeed((current) => current + 1)}
              style={styles.ruleRefreshPill}>
              <Ionicons name="shuffle-outline" size={16} color="#0F766E" />
              <Text style={styles.ruleFilterText}>Đổi món</Text>
            </Pressable>
          </View>

          {context == null ? (
            <ActivityIndicator color="#14B8A6" />
          ) : ruleRecommendations.length === 0 ? (
            <View style={styles.ruleEmpty}>
              <Ionicons name="search-outline" size={22} color="#14B8A6" />
              <Text style={styles.ruleText}>Chưa tìm thấy món phù hợp trong khung bữa hiện tại.</Text>
            </View>
          ) : (
            ruleRecommendations.map((food, index) => (
              <Pressable
                key={`${food.food_name}-${food.serving}`}
                onPress={() =>
                  router.push({
                    pathname: '/manual-meal',
                    params: {
                      foodName: food.food_name,
                      mealType: ruleMeal,
                    },
                  })
                }
                style={styles.ruleCard}>
                <View style={styles.ruleRank}>
                  <Text style={styles.ruleRankText}>{index + 1}</Text>
                </View>
                <View style={styles.ruleFoodCopy}>
                  <Text style={styles.ruleFoodName}>{food.food_name}</Text>
                  <Text style={styles.ruleFoodMeta}>
                    {food.serving} · {food.calories} kcal · P {food.protein_g}g · F {food.fat_g}g · C {food.carbs_g}g
                  </Text>
                  <Text style={styles.ruleReason}>{food.reason}</Text>
                </View>
              </Pressable>
            ))
          )}

        </ScrollView>
      ) : (
        <>
          <View style={styles.quickRow}>
            {QUICK_PROMPTS.map((prompt) => (
              <Pressable
                disabled={isLoading}
                key={prompt}
                onPress={() => sendMessage(prompt)}
                style={styles.quickButton}>
                <Text style={styles.quickText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chatPanel}>
            <ScrollView
              contentContainerStyle={styles.chatList}
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}>
              {messages.map((message) => {
                const isUser = message.role === 'user';

                return (
                  <View key={message.id} style={[styles.messageRow, isUser && styles.userMessageRow]}>
                    <View
                      style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                      ]}>
                      {!isUser ? (
                        <View style={styles.assistantIcon}>
                          <Ionicons name="sparkles-outline" size={16} color="#14B8A6" />
                        </View>
                      ) : null}
                      <View style={[styles.messageTextWrap, !isUser && styles.assistantTextWrap]}>
                        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                          {message.text}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              {isLoading ? (
                <View style={styles.messageRow}>
                  <View style={[styles.messageBubble, styles.assistantBubble]}>
                    <ActivityIndicator color="#14B8A6" size="small" />
                    <View style={styles.assistantTextWrap}>
                      <Text style={styles.messageText}>Đang tìm món phù hợp...</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.inputBar}>
              <TextInput
                editable={!isLoading}
                onChangeText={setInput}
                onSubmitEditing={() => sendMessage(input)}
                placeholder="Nhập món muốn ăn hoặc mục tiêu..."
                placeholderTextColor="#94A3B8"
                returnKeyType="send"
                style={styles.input}
                value={input}
              />
              <Pressable
                disabled={isLoading || input.trim().length === 0}
                onPress={() => sendMessage(input)}
                style={[styles.sendButton, (isLoading || input.trim().length === 0) && styles.sendButtonDisabled]}>
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F0FDFA',
    flex: 1,
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
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
    gap: 14,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
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
    fontWeight: '900',
    letterSpacing: 0,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  goalItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  goalLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  goalValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '800',
  },
  modeRow: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 6,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
  },
  modeButtonActive: {
    backgroundColor: '#14B8A6',
  },
  modeText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  ruleList: {
    gap: 10,
    paddingBottom: 10,
  },
  ruleIntro: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  ruleIntroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  ruleIntroCopy: {
    flex: 1,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  ruleTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
  ruleText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  ruleFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleMealRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ruleFilterButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  ruleRefreshPill: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  ruleFilterButtonActive: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  ruleFilterText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '900',
  },
  ruleFilterTextActive: {
    color: '#FFFFFF',
  },
  ruleEmpty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  ruleCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  ruleRank: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  ruleRankText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '900',
  },
  ruleFoodCopy: {
    flex: 1,
    gap: 5,
  },
  ruleFoodName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  ruleFoodMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  ruleReason: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '900',
  },
  chatPanel: {
    flex: 1,
    minHeight: 0,
  },
  chatList: {
    flexGrow: 1,
    gap: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
  messageRow: {
    alignItems: 'flex-start',
    width: '100%',
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 8,
    maxWidth: '88%',
    padding: 12,
  },
  assistantBubble: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },
  userBubble: {
    backgroundColor: '#14B8A6',
  },
  assistantIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  messageTextWrap: {
    flexShrink: 1,
  },
  assistantTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  messageText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  inputBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
  },
  input: {
    color: '#0F172A',
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    paddingHorizontal: 8,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
