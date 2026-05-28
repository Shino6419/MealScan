import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { safeRequest } from '@/utils/safeRequest';
import { supabase } from '@/utils/supabase';

type RecommendedFood = {
  calories: number;
  carbs_g: number;
  fat_g: number;
  food_name: string;
  id: string;
  meal_tags: string | null;
  protein_g: number;
  serving: string;
};

const COLORS = {
  background: '#F0FDFA',
  card: '#FFFFFF',
  line: '#CCFBF1',
  muted: '#64748B',
  primary: '#14B8A6',
  text: '#0F172A',
};

const MEAL_TYPES = [
  { icon: 'sunny-outline', label: 'Bữa sáng', value: 'breakfast' },
  { icon: 'restaurant-outline', label: 'Bữa trưa', value: 'lunch' },
  { icon: 'cafe-outline', label: 'Bữa chiều', value: 'afternoon' },
  { icon: 'moon-outline', label: 'Bữa tối', value: 'dinner' },
] as const;

type MealType = (typeof MEAL_TYPES)[number]['value'];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMealTypeFromDate(date: Date): MealType {
  const hour = date.getHours();

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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function getValidMealType(value?: string): MealType | null {
  return MEAL_TYPES.some((type) => type.value === value) ? (value as MealType) : null;
}

function formatMacro(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function ManualMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ foodName?: string; mealDate?: string; mealType?: string }>();
  const initialFoodName = typeof params.foodName === 'string' ? params.foodName : '';
  const initialMealType = getValidMealType(typeof params.mealType === 'string' ? params.mealType : undefined);
  const hasPresetMealType = initialMealType != null;
  const selectedDateKey =
    typeof params.mealDate === 'string' && params.mealDate
      ? params.mealDate
      : formatDateKey(new Date());
  const [foods, setFoods] = useState<RecommendedFood[]>([]);
  const [selectedFood, setSelectedFood] = useState<RecommendedFood | null>(null);
  const [query, setQuery] = useState(initialFoodName);
  const [quantity, setQuantity] = useState('1');
  const [mealType, setMealType] = useState<MealType>(() => initialMealType ?? getMealTypeFromDate(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFoods() {
      setIsLoading(true);
      const { data } = await safeRequest(
        supabase
          .from('recommended_foods')
          .select('id, food_name, serving, calories, protein_g, fat_g, carbs_g, meal_tags')
          .eq('is_active', true)
          .order('food_name', { ascending: true })
          .limit(300),
        { data: [] },
      );

      if (isMounted) {
        const nextFoods = (data ?? []) as RecommendedFood[];
        setFoods(nextFoods);

        if (initialFoodName) {
          const normalizedInitialName = normalizeSearchText(initialFoodName);
          const matchedFood =
            nextFoods.find((food) => normalizeSearchText(food.food_name) === normalizedInitialName) ??
            nextFoods.find((food) => normalizeSearchText(food.food_name).includes(normalizedInitialName));

          if (matchedFood) {
            setSelectedFood(matchedFood);
            setQuery(matchedFood.food_name);
          }
        }

        setIsLoading(false);
      }
    }

    loadFoods();

    return () => {
      isMounted = false;
    };
  }, [initialFoodName]);

  const filteredFoods = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    const source = normalizedQuery
      ? foods.filter((food) => normalizeSearchText(food.food_name).includes(normalizedQuery))
      : foods;

    return source.slice(0, 40);
  }, [foods, query]);
  const quantityValue = Number(quantity.replace(',', '.'));
  const displayQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
  const totalCalories = selectedFood ? Math.round(selectedFood.calories * displayQuantity) : 0;
  const totalProtein = selectedFood ? selectedFood.protein_g * displayQuantity : 0;
  const totalFat = selectedFood ? selectedFood.fat_g * displayQuantity : 0;
  const totalCarbs = selectedFood ? selectedFood.carbs_g * displayQuantity : 0;

  function handleSelectFood(food: RecommendedFood) {
    setSelectedFood(food);
    setQuery(food.food_name);

    const foodMealTags = (food.meal_tags ?? '').split('|');
    const suggestedMealType = MEAL_TYPES.find((type) => foodMealTags.includes(type.value))?.value;

    if (!hasPresetMealType && suggestedMealType) {
      setMealType(suggestedMealType);
    }
  }

  async function handleSave() {
    if (!selectedFood) {
      Alert.alert('Chưa chọn món', 'Vui lòng chọn một món trong danh sách.');
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      Alert.alert('Số lượng không hợp lệ', 'Vui lòng nhập số lượng lớn hơn 0.');
      return;
    }

    setIsSaving(true);
    const { data: authData } = await supabase.auth
      .getUser()
      .catch(() => ({ data: { user: null } }));
    const userId = authData.user?.id;

    if (!userId) {
      setIsSaving(false);
      Alert.alert('Chưa đăng nhập', 'Vui lòng đăng nhập lại.');
      router.replace('/login');
      return;
    }

    const { data: meal, error } = await safeRequest(
      supabase
        .from('meals')
        .insert({
          calories: totalCalories,
          carbs_g: Number(totalCarbs.toFixed(1)),
          eaten_at: new Date().toISOString(),
          fat_g: Number(totalFat.toFixed(1)),
          food_name: selectedFood.food_name,
          meal_date: selectedDateKey,
          meal_type: mealType,
          notes: `Số lượng: ${displayQuantity} x ${selectedFood.serving}; ${selectedFood.calories} kcal, P ${formatMacro(selectedFood.protein_g)}g, F ${formatMacro(selectedFood.fat_g)}g, C ${formatMacro(selectedFood.carbs_g)}g/${selectedFood.serving}`,
          protein_g: Number(totalProtein.toFixed(1)),
          source: 'manual',
          user_id: userId,
        })
        .select('id')
        .single(),
      { data: null, error: new Error('Network request failed') },
    );

    setIsSaving(false);

    if (error) {
      Alert.alert('Lưu thất bại', error.message);
      return;
    }

    Alert.alert('Đã thêm món', 'Món ăn đã được thêm vào thống kê.', [
      {
        text: 'Xem chi tiết',
        onPress: () =>
          router.replace({
            pathname: '/meal-detail',
            params: { id: meal?.id },
          }),
      },
      { text: 'Về thống kê', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        <Text style={styles.backText}>Quay lại</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <Text style={styles.kicker}>Manual meal</Text>
        <Text style={styles.title}>Thêm món thủ công</Text>
        <Text style={styles.subtitle}>Tìm món trong danh sách đã lưu và thêm vào ngày {selectedDateKey}.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Tìm món ăn</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={COLORS.muted} />
            <TextInput
              onChangeText={(value) => {
                setQuery(value);
                setSelectedFood(null);
              }}
              placeholder="Nhập tên món..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              value={query}
            />
          </View>
        </View>

        <View style={styles.foodList}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : filteredFoods.length === 0 ? (
            <Text style={styles.emptyText}>Không tìm thấy món phù hợp.</Text>
          ) : (
            filteredFoods.map((food) => {
              const isSelected = selectedFood?.id === food.id;

              return (
                <Pressable
                  key={food.id}
                  onPress={() => handleSelectFood(food)}
                  style={[styles.foodItem, isSelected && styles.foodItemSelected]}>
                  <View style={styles.foodCopy}>
                    <Text style={styles.foodName}>{food.food_name}</Text>
                    <Text style={styles.foodMeta}>
                      {food.serving} · {food.calories} kcal · P {formatMacro(food.protein_g)}g · F {formatMacro(food.fat_g)}g · C {formatMacro(food.carbs_g)}g
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Khung bữa ăn</Text>
          <View style={styles.mealGrid}>
            {MEAL_TYPES.map((type) => {
              const isSelected = mealType === type.value;

              return (
                <Pressable
                  key={type.value}
                  onPress={() => setMealType(type.value)}
                  style={[styles.mealButton, isSelected && styles.mealButtonSelected]}>
                  <Ionicons
                    name={type.icon}
                    size={18}
                    color={isSelected ? '#FFFFFF' : COLORS.primary}
                  />
                  <Text style={[styles.mealButtonText, isSelected && styles.mealButtonTextSelected]}>
                    {type.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Số lượng</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={(value) => setQuantity(value.replace(',', '.'))}
            placeholder="1"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={quantity}
          />
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Calo</Text>
            <Text style={styles.summaryValue}>{totalCalories}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Protein</Text>
            <Text style={styles.summaryValue}>{formatMacro(totalProtein)}g</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Fat</Text>
            <Text style={styles.summaryValue}>{formatMacro(totalFat)}g</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>Carb</Text>
            <Text style={styles.summaryValue}>{formatMacro(totalCarbs)}g</Text>
          </View>
        </View>

        <Pressable
          disabled={isSaving || !selectedFood}
          onPress={handleSave}
          style={[styles.saveButton, (!selectedFood || isSaving) && styles.saveButtonDisabled]}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Thêm vào thống kê</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
  },
  backText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    padding: 12,
  },
  field: {
    gap: 8,
  },
  foodCopy: {
    flex: 1,
    gap: 5,
  },
  foodItem: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  foodItemSelected: {
    backgroundColor: '#ECFEFF',
    borderColor: COLORS.primary,
  },
  foodList: {
    gap: 8,
    maxHeight: 360,
  },
  foodMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  foodName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  form: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 14,
  },
  header: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 14,
    overflow: 'hidden',
    padding: 18,
  },
  headerStripe: {
    backgroundColor: '#38BDF8',
    height: 5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  kicker: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  mealButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  mealButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  mealButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  mealButtonTextSelected: {
    color: '#FFFFFF',
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  screen: {
    backgroundColor: COLORS.background,
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryTile: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.line,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 10,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
