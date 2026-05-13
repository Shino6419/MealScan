import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/utils/supabase';

type MealDetail = {
  id: string;
  food_name: string;
  calories: number;
  meal_type: string;
  eaten_at: string;
  image_url: string | null;
  notes: string | null;
};

export default function MealDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMeal() {
      if (!id) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('meals')
        .select('id, food_name, calories, meal_type, eaten_at, image_url, notes')
        .eq('id', id)
        .maybeSingle();

      if (isMounted) {
        if (error) {
          Alert.alert('Khong tai duoc du lieu', error.message);
        }
        setMeal(data ?? null);
        setIsLoading(false);
      }
    }

    loadMeal();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleDelete() {
    if (!meal) {
      return;
    }

    setIsDeleting(true);
    const { error } = await supabase.from('meals').delete().eq('id', meal.id);
    setIsDeleting(false);

    if (error) {
      Alert.alert('Xoa that bai', error.message);
      return;
    }

    Alert.alert('Da xoa', 'Mon an da duoc xoa khoi lich su.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
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
            <Text style={styles.kicker}>Meal detail</Text>
            <Text style={styles.title}>Chi tiet mon an</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="restaurant-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Thong tin mon an da luu trong lich su.</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#14B8A6" />
        </View>
      ) : meal ? (
        <View style={styles.detailCard}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={40} color="#14B8A6" />
          </View>

          <Text style={styles.mealName}>{meal.food_name}</Text>
          <Text style={styles.calories}>{meal.calories} kcal</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Loai bua an</Text>
            <Text style={styles.metaValue}>{meal.meal_type}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Thoi gian</Text>
            <Text style={styles.metaValue}>
              {new Date(meal.eaten_at).toLocaleString('vi-VN')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Ghi chu</Text>
            <Text style={styles.metaValue}>{meal.notes || 'Khong co'}</Text>
          </View>

          <Pressable disabled={isDeleting} onPress={handleDelete} style={styles.deleteButton}>
            {isDeleting ? (
              <ActivityIndicator color="#dc2626" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                <Text style={styles.deleteButtonText}>Xoa mon an</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="alert-circle-outline" size={30} color="#64748b" />
          <Text style={styles.emptyTitle}>Khong tim thay mon an</Text>
        </View>
      )}
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
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  imagePlaceholder: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 18,
  },
  mealName: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  calories: {
    color: '#14B8A6',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 8,
  },
  metaRow: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  metaValue: {
    color: '#111827',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  deleteButton: {
    alignItems: 'center',
    borderColor: '#fca5a5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
  },
});
