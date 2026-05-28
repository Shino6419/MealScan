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

import { safeRequest } from '@/utils/safeRequest';
import { supabase } from '@/utils/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const fullNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim();
  const normalizedName = fullName.trim();
  const canSubmit =
    normalizedName.length > 0 &&
    normalizedEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isSubmitting;

  async function handleRegister() {
    if (!canSubmit) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên, email và mật khẩu.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng nhập lại mật khẩu xác nhận.');
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth
      .signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
          },
        },
      })
      .catch((requestError: Error) => ({ data: { user: null, session: null }, error: requestError }));

    if (error) {
      setIsSubmitting(false);
      const message =
        error.message === 'Network request failed'
          ? 'Không kết nối được Supabase. Vui lòng kiểm tra mạng của emulator hoặc thử lại sau.'
          : error.message;
      Alert.alert('Đăng ký thất bại', message);
      return;
    }

    if (data.user?.identities?.length === 0) {
      setIsSubmitting(false);
      Alert.alert('Đăng ký thất bại', 'Email này đã được đăng ký. Vui lòng đăng nhập.');
      return;
    }

    if (data.user && data.session) {
      const { error: profileError } = await safeRequest(
        supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: normalizedName,
        }),
        { error: new Error('Network request failed') },
      );

      setIsSubmitting(false);

      if (profileError) {
        Alert.alert(
          'Đăng ký thành công',
          'Tài khoản đã tạo, nhưng chưa lưu được tên hiển thị. Bạn có thể cập nhật sau.',
          [{ text: 'OK', onPress: () => router.replace('/body-profile') }],
        );
        return;
      }

      router.replace('/body-profile');
      return;
    }

    setIsSubmitting(false);
    Alert.alert(
      'Kiểm tra email',
      'Tài khoản đã được tạo. Vui lòng xác nhận email trước khi đăng nhập.',
      [{ text: 'OK', onPress: () => router.replace('/login') }],
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
              <Text style={styles.title}>Tạo tài khoản</Text>
            </View>
            <View style={styles.logoMark}>
              <Ionicons name="person-add" size={26} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>
            Tạo tài khoản trước, sau đó MealScan sẽ hỏi thêm thông tin thể trạng.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Họ tên</Text>
            <Pressable onPress={() => fullNameInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color="#64748b" />
              <TextInput
                ref={fullNameInputRef}
                autoCapitalize="words"
                editable={!isSubmitting}
                onChangeText={setFullName}
                onSubmitEditing={() => emailInputRef.current?.focus()}
                placeholder="Nguyễn Văn A"
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
                onSubmitEditing={() => passwordInputRef.current?.focus()}
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
            <Text style={styles.label}>Mật khẩu</Text>
            <Pressable onPress={() => passwordInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
              <TextInput
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setPassword}
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                placeholder="Ít nhất 6 ký tự"
                placeholderTextColor="#94a3b8"
                returnKeyType="next"
                secureTextEntry={!isPasswordVisible}
                showSoftInputOnFocus
                style={styles.input}
                textContentType="newPassword"
                value={password}
              />
              <Pressable
                accessibilityLabel={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
            <Text style={styles.label}>Nhập lại mật khẩu</Text>
            <Pressable onPress={() => confirmPasswordInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#64748b" />
              <TextInput
                ref={confirmPasswordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleRegister}
                placeholder="Xác nhận mật khẩu"
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
                <Text style={styles.primaryButtonText}>Đăng ký</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Đã có tài khoản?</Text>
            <Text style={styles.secondaryLink}>Đăng nhập</Text>
          </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    marginBottom: 18,
    overflow: 'hidden',
    padding: 20,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
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
    elevation: 3,
    gap: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
