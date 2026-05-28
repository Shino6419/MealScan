import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  classifyFoodImage,
  FOOD_CALORIE_REFERENCES,
  type FoodPrediction,
} from '@/utils/foodClassifier';
import { safeRequest } from '@/utils/safeRequest';
import { supabase } from '@/utils/supabase';

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMealTypeFromDate(date: Date) {
  const hour = date.getHours();

  if (hour < 4) {
    return 'dinner';
  }

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

function getInitialDate(value?: string) {
  const parsedDate = value ? new Date(value) : new Date();

  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

const MEAL_TYPE_OPTIONS = [
  { value: 'breakfast', label: 'Bữa sáng', icon: 'sunny-outline' },
  { value: 'lunch', label: 'Bữa trưa', icon: 'restaurant-outline' },
  { value: 'afternoon', label: 'Bữa chiều', icon: 'cafe-outline' },
  { value: 'dinner', label: 'Bữa tối', icon: 'moon-outline' },
] as const;

type MealType = (typeof MEAL_TYPE_OPTIONS)[number]['value'];

function formatMacro(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function MealResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    imageName?: string;
    imageUri?: string;
    scannedAt?: string;
  }>();
  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : '';
  const imageName = typeof params.imageName === 'string' ? params.imageName : '';
  const [scanDate] = useState(() =>
    getInitialDate(typeof params.scannedAt === 'string' ? params.scannedAt : undefined),
  );
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedMealType, setSelectedMealType] = useState<MealType>(
    () => getMealTypeFromDate(scanDate),
  );
  const [caloriesPerServing, setCaloriesPerServing] = useState<number | null>(null);
  const [proteinPerServing, setProteinPerServing] = useState(0);
  const [fatPerServing, setFatPerServing] = useState(0);
  const [carbsPerServing, setCarbsPerServing] = useState(0);
  const [servingUnit, setServingUnit] = useState('1 phần');
  const [isSaving, setIsSaving] = useState(false);
  const [isPredicting, setIsPredicting] = useState(Boolean(imageUri));
  const [prediction, setPrediction] = useState<FoodPrediction | null>(null);
  const [predictionError, setPredictionError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function predictFood() {
      if (!imageUri) {
        setIsPredicting(false);
        return;
      }

      setIsPredicting(true);
      setPredictionError('');

      try {
        const result = await classifyFoodImage(imageUri);

        if (!isActive) {
          return;
        }

        setPrediction(result);
        setFoodName(result.label);
        setCaloriesPerServing(result.calories);
        setProteinPerServing(result.protein);
        setFatPerServing(result.fat);
        setCarbsPerServing(result.carbs);
        setServingUnit(
          FOOD_CALORIE_REFERENCES.find((item) => item.label === result.label)?.serving ?? '1 phần',
        );
        setCalories(String(result.calories));
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Không thể chạy model trên ảnh này.';
        setPredictionError(message);
      } finally {
        if (isActive) {
          setIsPredicting(false);
        }
      }
    }

    predictFood();

    return () => {
      isActive = false;
    };
  }, [imageUri]);

  function handleQuantityChange(value: string) {
    const normalizedValue = value.replace(',', '.');
    setQuantity(normalizedValue);

    const quantityValue = Number(normalizedValue);
    if (caloriesPerServing && Number.isFinite(quantityValue) && quantityValue > 0) {
      setCalories(String(Math.round(caloriesPerServing * quantityValue)));
    }
  }

  async function handleSaveMeal() {
    const calorieValue = Number(calories);
    const quantityValue = Number(quantity);
    const totalProtein = Number((proteinPerServing * quantityValue).toFixed(1));
    const totalFat = Number((fatPerServing * quantityValue).toFixed(1));
    const totalCarbs = Number((carbsPerServing * quantityValue).toFixed(1));

    if (!foodName.trim()) {
      Alert.alert('Thiếu tên món', 'Vui lòng nhập tên món ăn.');
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      Alert.alert('Số lượng không hợp lệ', 'Vui lòng nhập số lượng lớn hơn 0.');
      return;
    }

    if (!Number.isFinite(calorieValue) || calorieValue < 0) {
      Alert.alert('Calo không hợp lệ', 'Vui lòng nhập số calo hợp lệ.');
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

    const mealPayload = {
      user_id: userId,
      meal_date: formatDateKey(scanDate),
      eaten_at: scanDate.toISOString(),
      meal_type: selectedMealType,
      food_name: foodName.trim(),
      calories: calorieValue,
      protein_g: totalProtein,
      fat_g: totalFat,
      carbs_g: totalCarbs,
      source: 'ai_scan',
      notes: caloriesPerServing
        ? `Số lượng: ${quantityValue} x ${servingUnit}; ${caloriesPerServing} kcal, P ${formatMacro(proteinPerServing)}g, F ${formatMacro(fatPerServing)}g, C ${formatMacro(carbsPerServing)}g/${servingUnit}`
        : `Số lượng: ${quantityValue}`,
    };

    let { data: meal, error } = await safeRequest(
      supabase
        .from('meals')
        .insert(mealPayload)
        .select('id')
        .single(),
      { data: null, error: new Error('Network request failed') },
    );

    if (error?.message.includes('meals_meal_type_check') && selectedMealType === 'afternoon') {
      const fallbackResult = await safeRequest(
        supabase
          .from('meals')
          .insert({ ...mealPayload, meal_type: 'snack' })
          .select('id')
          .single(),
        { data: null, error: new Error('Network request failed') },
      );

      meal = fallbackResult.data;
      error = fallbackResult.error;
    }

    setIsSaving(false);

    if (error) {
      Alert.alert('Lưu thất bại', error.message);
      return;
    }

    Alert.alert('Đã thêm vào lịch sử', 'Món ăn đã được lưu vào thống kê hôm nay.', [
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

  const quantityValue = Number(quantity);
  const displayQuantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
  const totalProtein = proteinPerServing * displayQuantity;
  const totalFat = fatPerServing * displayQuantity;
  const totalCarbs = carbsPerServing * displayQuantity;

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color="#0f172a" />
        <Text style={styles.backText}>Quay lại</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.kicker}>Kết quả AI</Text>
            <Text style={styles.title}>Kết quả AI</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Kiểm tra và sửa kết quả trước khi thêm vào lịch sử.</Text>
      </View>

      {imageUri ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.foodImage} />
          <View style={styles.imageBadge}>
            <Ionicons name="image-outline" size={16} color="#14B8A6" />
            <Text numberOfLines={1} style={styles.imageBadgeText}>
              {imageName || 'Ảnh từ thư viện'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={42} color="#14B8A6" />
          <Text style={styles.imageText}>Chưa có ảnh món ăn</Text>
        </View>
      )}

      <View style={styles.predictionCard}>
        {isPredicting ? (
          <>
            <ActivityIndicator color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Đang phân tích món ăn</Text>
              <Text style={styles.predictionText}>Model đang xử lý ảnh 224x224...</Text>
            </View>
          </>
        ) : prediction ? (
          <>
            <Ionicons name="sparkles-outline" size={22} color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>
                Dự đoán: {prediction.label}
              </Text>
              <Text style={styles.predictionText}>
                Khoảng {prediction.calories} kcal/{servingUnit} - P {formatMacro(prediction.protein)}g, F {formatMacro(prediction.fat)}g, C {formatMacro(prediction.carbs)}g.
              </Text>
            </View>
          </>
        ) : predictionError ? (
          <>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Chưa chạy được model</Text>
              <Text style={styles.predictionText}>{predictionError}</Text>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={22} color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Chưa có ảnh để phân tích</Text>
              <Text style={styles.predictionText}>Hãy quay lại màn hình chụp ảnh và chọn ảnh món ăn.</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Tên món ăn</Text>
          <TextInput
            onChangeText={setFoodName}
            placeholder="Nhập tên món"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={foodName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Khung bữa ăn</Text>
          <View style={styles.mealTypeGrid}>
            {MEAL_TYPE_OPTIONS.map((option) => {
              const isSelected = selectedMealType === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSelectedMealType(option.value)}
                  style={[styles.mealTypeButton, isSelected && styles.mealTypeButtonSelected]}>
                  <Ionicons
                    name={option.icon}
                    size={19}
                    color={isSelected ? '#fff' : '#14B8A6'}
                  />
                  <View style={styles.mealTypeCopy}>
                    <Text style={[styles.mealTypeLabel, isSelected && styles.mealTypeTextSelected]}>
                      {option.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Số lượng</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={handleQuantityChange}
            placeholder="Nhập số lượng"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={quantity}
          />
          <Text style={styles.helperText}>
            {caloriesPerServing
              ? `Mỗi ${servingUnit}: ${caloriesPerServing} kcal, Protein ${formatMacro(proteinPerServing)}g, Fat ${formatMacro(fatPerServing)}g, Carb ${formatMacro(carbsPerServing)}g.`
              : 'Nhập số lượng theo đơn vị của món ăn để tính tổng calo.'}
          </Text>
        </View>

        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionTile}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.nutritionValue}>{formatMacro(totalProtein)}g</Text>
          </View>
          <View style={styles.nutritionTile}>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.nutritionValue}>{formatMacro(totalFat)}g</Text>
          </View>
          <View style={styles.nutritionTile}>
            <Text style={styles.nutritionLabel}>Carb</Text>
            <Text style={styles.nutritionValue}>{formatMacro(totalCarbs)}g</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tổng calo ước tính</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setCalories}
            placeholder="Nhập calo"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={calories}
          />
        </View>

        <Pressable disabled={isSaving} onPress={handleSaveMeal} style={styles.primaryButton}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Thêm vào lịch sử</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F0FDFA',
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
  },
  backText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    marginBottom: 22,
    padding: 20,
    overflow: 'hidden',
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
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#14B8A6',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  title: {
    color: '#0F172A',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  imagePlaceholder: {
    alignItems: 'center',
    aspectRatio: 16 / 10,
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  imagePreview: {
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  foodImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  imageBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
    left: 12,
    maxWidth: '86%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'absolute',
  },
  imageBadgeText: {
    color: '#0F172A',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  imageText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  predictionCard: {
    alignItems: 'flex-start',
    backgroundColor: '#ECFEFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  predictionCopy: {
    flex: 1,
    gap: 4,
  },
  predictionTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  predictionText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  form: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    marginTop: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  mealTypeGrid: {
    gap: 8,
  },
  mealTypeButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealTypeButtonSelected: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  mealTypeCopy: {
    flex: 1,
    gap: 2,
  },
  mealTypeLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  mealTypeTextSelected: {
    color: '#fff',
  },
  nutritionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  nutritionTile: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  nutritionLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  nutritionValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
