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

import { supabase } from '@/utils/supabase';
import {
  classifyFoodImage,
  FOOD_CALORIE_REFERENCES,
  type FoodPrediction,
} from '@/utils/foodClassifier';
import { AUTH_DISABLED } from '@/constants/app-config';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getAutoMealType() {
  const hour = new Date().getHours();

  if (hour < 10) {
    return 'breakfast';
  }

  if (hour < 14) {
    return 'lunch';
  }

  if (hour < 21) {
    return 'dinner';
  }

  return 'snack';
}

export default function MealResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageName?: string; imageUri?: string }>();
  const imageUri = typeof params.imageUri === 'string' ? params.imageUri : '';
  const imageName = typeof params.imageName === 'string' ? params.imageName : '';
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [caloriesPerServing, setCaloriesPerServing] = useState<number | null>(null);
  const [servingUnit, setServingUnit] = useState('1 phan');
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
        setServingUnit(
          FOOD_CALORIE_REFERENCES.find((item) => item.label === result.label)?.serving ?? '1 phan',
        );
        setCalories(String(result.calories));
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Khong the chay model tren anh nay.';
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

    if (!foodName.trim()) {
      Alert.alert('Thieu ten mon', 'Vui long nhap ten mon an.');
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      Alert.alert('So luong khong hop le', 'Vui long nhap so luong lon hon 0.');
      return;
    }

    if (!Number.isFinite(calorieValue) || calorieValue < 0) {
      Alert.alert('Calo khong hop le', 'Vui long nhap so calo hop le.');
      return;
    }

    setIsSaving(true);

    if (AUTH_DISABLED) {
      setIsSaving(false);
      Alert.alert('Da them vao lich su demo', 'Dang nhap Supabase dang tam tat nen mon an chua luu len server.', [
        { text: 'Ve thong ke', onPress: () => router.replace('/(tabs)') },
      ]);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setIsSaving(false);
      Alert.alert('Chua dang nhap', 'Vui long dang nhap lai.');
      router.replace('/login');
      return;
    }

    const now = new Date().toISOString();
    const { data: meal, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        meal_date: getTodayKey(),
        eaten_at: now,
        meal_type: getAutoMealType(),
        food_name: foodName.trim(),
        calories: calorieValue,
        source: 'ai_scan',
        notes: caloriesPerServing
          ? `So luong: ${quantityValue} x ${servingUnit}; uoc tinh ${caloriesPerServing} kcal/${servingUnit}`
          : `So luong: ${quantityValue}`,
      })
      .select('id')
      .single();

    setIsSaving(false);

    if (error) {
      Alert.alert('Luu that bai', error.message);
      return;
    }

    Alert.alert('Da them vao lich su', 'Mon an da duoc luu vao thong ke hom nay.', [
      {
        text: 'Xem chi tiet',
        onPress: () =>
          router.replace({
            pathname: '/meal-detail',
            params: { id: meal.id },
          }),
      },
      { text: 'Ve thong ke', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={22} color="#0f172a" />
        <Text style={styles.backText}>Quay lai</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.kicker}>AI result</Text>
            <Text style={styles.title}>Ket qua AI</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Kiem tra va sua ket qua truoc khi them vao lich su.</Text>
      </View>

      {imageUri ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.foodImage} />
          <View style={styles.imageBadge}>
            <Ionicons name="image-outline" size={16} color="#14B8A6" />
            <Text numberOfLines={1} style={styles.imageBadgeText}>
              {imageName || 'Anh tu thu vien'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={42} color="#14B8A6" />
          <Text style={styles.imageText}>Chua co anh mon an</Text>
        </View>
      )}

      <View style={styles.predictionCard}>
        {isPredicting ? (
          <>
            <ActivityIndicator color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Dang phan tich mon an</Text>
              <Text style={styles.predictionText}>Model dang xu ly anh 224x224...</Text>
            </View>
          </>
        ) : prediction ? (
          <>
            <Ionicons name="sparkles-outline" size={22} color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>
                Du doan: {prediction.label}
              </Text>
              <Text style={styles.predictionText}>
                Khoang {prediction.calories} kcal/{servingUnit} - do tin cay {Math.round(prediction.confidence * 100)}%.
              </Text>
            </View>
          </>
        ) : predictionError ? (
          <>
            <Ionicons name="warning-outline" size={22} color="#F97316" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Chua chay duoc model</Text>
              <Text style={styles.predictionText}>{predictionError}</Text>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={22} color="#14B8A6" />
            <View style={styles.predictionCopy}>
              <Text style={styles.predictionTitle}>Chua co anh de phan tich</Text>
              <Text style={styles.predictionText}>Hay quay lai man hinh chup anh va chon anh mon an.</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Ten mon an</Text>
          <TextInput
            onChangeText={setFoodName}
            placeholder="Nhap ten mon"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={foodName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>So luong</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={handleQuantityChange}
            placeholder="Nhap so luong"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={quantity}
          />
          <Text style={styles.helperText}>
            {caloriesPerServing
              ? `AI uoc tinh ${caloriesPerServing} kcal cho ${servingUnit}. Tong calo se tinh theo so luong.`
              : 'Nhap so luong theo don vi cua mon an de tinh tong calo.'}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tong calo uoc tinh</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setCalories}
            placeholder="Nhap calo"
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
              <Text style={styles.primaryButtonText}>Them vao lich su</Text>
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
