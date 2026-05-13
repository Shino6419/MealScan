import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

import { supabase } from '@/utils/supabase';

const DEFAULT_CALORIE_GOAL = '2000';

export default function RegisterScreen() {
  const router = useRouter();
  const fullNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const calorieInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(DEFAULT_CALORIE_GOAL);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim();
  const normalizedName = fullName.trim();
  const calorieGoal = Number(dailyCalorieGoal);
  const canSubmit =
    normalizedName.length > 0 &&
    normalizedEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    dailyCalorieGoal.length > 0 &&
    !isSubmitting;

  async function handleRegister() {
    if (!canSubmit) {
      Alert.alert('Thieu thong tin', 'Vui long nhap day du thong tin dang ky.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mat khau qua ngan', 'Mat khau can co it nhat 6 ky tu.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mat khau khong khop', 'Vui long nhap lai mat khau xac nhan.');
      return;
    }

    if (!Number.isFinite(calorieGoal) || calorieGoal <= 0) {
      Alert.alert('Muc tieu calo khong hop le', 'Vui long nhap so calo lon hon 0.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedName,
        },
      },
    });

    if (error) {
      setIsSubmitting(false);
      Alert.alert('Dang ky that bai', error.message);
      return;
    }

    if (data.user?.identities?.length === 0) {
      setIsSubmitting(false);
      Alert.alert('Dang ky that bai', 'Email nay da duoc dang ky. Vui long dang nhap.');
      return;
    }

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: normalizedName,
        daily_calorie_goal: calorieGoal,
      });

      setIsSubmitting(false);

      if (profileError) {
        Alert.alert(
          'Dang ky thanh cong',
          'Tai khoan da tao, nhung chua luu duoc muc tieu calo.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      Alert.alert('Dang ky thanh cong', 'Tai khoan cua ban da duoc tao.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
      return;
    }

    setIsSubmitting(false);
    Alert.alert(
      'Kiem tra email',
      'Tai khoan da duoc tao. Vui long xac nhan email truoc khi dang nhap.',
      [{ text: 'OK', onPress: () => router.replace('/login') }]
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerStripe} />
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.kicker}>MealScan</Text>
              <Text style={styles.title}>Tao tai khoan</Text>
            </View>
            <View style={styles.logoMark}>
              <Ionicons name="person-add" size={26} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>Nhap muc tieu calo moi ngay de bat dau theo doi bua an.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Ho ten</Text>
            <Pressable onPress={() => fullNameInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color="#64748b" />
              <TextInput
                ref={fullNameInputRef}
                autoCapitalize="words"
                editable={!isSubmitting}
                onChangeText={setFullName}
                onSubmitEditing={() => emailInputRef.current?.focus()}
                placeholder="Nguyen Van A"
                placeholderTextColor="#94a3b8"
                returnKeyType="next"
                showSoftInputOnFocus
                style={styles.input}
                textContentType="name"
                value={fullName}
              />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Pressable onPress={() => emailInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color="#64748b" />
              <TextInput
                ref={emailInputRef}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isSubmitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={() => calorieInputRef.current?.focus()}
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                returnKeyType="next"
                showSoftInputOnFocus
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Muc tieu calo moi ngay</Text>
            <Pressable onPress={() => calorieInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="flame-outline" size={20} color="#64748b" />
              <TextInput
                ref={calorieInputRef}
                keyboardType="number-pad"
                editable={!isSubmitting}
                onChangeText={setDailyCalorieGoal}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                placeholder="2000"
                placeholderTextColor="#94a3b8"
                returnKeyType="next"
                showSoftInputOnFocus
                style={styles.input}
                value={dailyCalorieGoal}
              />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mat khau</Text>
            <Pressable onPress={() => passwordInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
              <TextInput
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setPassword}
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                placeholder="It nhat 6 ky tu"
                placeholderTextColor="#94a3b8"
                returnKeyType="next"
                secureTextEntry={!isPasswordVisible}
                showSoftInputOnFocus
                style={styles.input}
                textContentType="newPassword"
                value={password}
              />
              <Pressable
                accessibilityLabel={isPasswordVisible ? 'An mat khau' : 'Hien mat khau'}
                hitSlop={10}
                onPress={() => setIsPasswordVisible((current) => !current)}>
                <Ionicons
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#475569"
                />
              </Pressable>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nhap lai mat khau</Text>
            <Pressable onPress={() => confirmPasswordInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#64748b" />
              <TextInput
                ref={confirmPasswordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleRegister}
                placeholder="Xac nhan mat khau"
                placeholderTextColor="#94a3b8"
                returnKeyType="done"
                secureTextEntry={!isPasswordVisible}
                showSoftInputOnFocus
                style={styles.input}
                textContentType="newPassword"
                value={confirmPassword}
              />
            </Pressable>
          </View>

          <Pressable
            disabled={!canSubmit}
            onPress={handleRegister}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit && styles.primaryButtonDisabled,
              pressed && canSubmit && styles.primaryButtonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Dang ky</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Da co tai khoan?</Text>
            <Text style={styles.secondaryLink}>Dang nhap</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0FDFA',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 20,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
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
  logoMark: {
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
    marginTop: 10,
    maxWidth: 340,
  },
  form: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
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
  inputWrap: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  input: {
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    minHeight: 52,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  secondaryText: {
    color: '#64748b',
    fontSize: 15,
  },
  secondaryLink: {
    color: '#14B8A6',
    fontSize: 15,
    fontWeight: '800',
  },
});
