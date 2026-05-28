import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

export default function AccountOptionsScreen() {
  const router = useRouter();
  const nameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = fullName.trim().length > 0 && !isLoading && !isSaving;

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      setIsLoading(true);

      const { data: authData } = await supabase.auth
        .getUser()
        .catch(() => ({ data: { user: null } }));
      const user = authData.user;

      if (!user) {
        if (isMounted) {
          setIsLoading(false);
        }
        router.replace('/login');
        return;
      }

      const { data: profile } = await safeRequest(
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        { data: null },
      );

      if (!isMounted) {
        return;
      }

      setEmail(user.email ?? '');
      setFullName(profile?.full_name ?? user.user_metadata?.full_name ?? '');
      setIsLoading(false);
    }

    loadAccount();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSave() {
    const normalizedName = fullName.trim();
    const shouldChangePassword = newPassword.length > 0 || confirmPassword.length > 0;

    if (!normalizedName) {
      Alert.alert('Thiếu tên hiển thị', 'Vui lòng nhập tên hiển thị.');
      return;
    }

    if (shouldChangePassword && newPassword.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu mới cần có ít nhất 6 ký tự.');
      return;
    }

    if (shouldChangePassword && newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng nhập lại mật khẩu xác nhận.');
      return;
    }

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

    const { error: profileError } = await safeRequest(
      supabase.from('profiles').update({ full_name: normalizedName }).eq('id', userId),
      { error: new Error('Network request failed') },
    );

    if (profileError) {
      setIsSaving(false);
      Alert.alert('Lưu thất bại', profileError.message);
      return;
    }

    const authUpdatePayload = shouldChangePassword
      ? { data: { full_name: normalizedName }, password: newPassword }
      : { data: { full_name: normalizedName } };

    const { error: authError } = await supabase.auth
      .updateUser(authUpdatePayload)
      .catch((requestError: Error) => ({ data: { user: null }, error: requestError }));

    setIsSaving(false);

    if (authError) {
      const message =
        authError.message === 'Network request failed'
          ? 'Không kết nối được Supabase. Vui lòng kiểm tra mạng của emulator hoặc thử lại sau.'
          : authError.message;
      Alert.alert('Cập nhật tài khoản thất bại', message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Đã lưu', 'Tùy chọn tài khoản đã được cập nhật.', [
      { text: 'OK', onPress: () => router.back() },
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
              <Text style={styles.kicker}>Account</Text>
              <Text style={styles.title}>Tùy chọn tài khoản</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="person-circle-outline" size={28} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>Cập nhật tên hiển thị và mật khẩu đăng nhập.</Text>
        </View>

        <View style={styles.form}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#14B8A6" />
              <Text style={styles.loadingText}>Đang tải tài khoản...</Text>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputWrap, styles.readOnlyInput]}>
                  <Ionicons name="mail-outline" size={20} color="#64748B" />
                  <Text style={styles.readOnlyText}>{email || 'Chưa có email'}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Tên hiển thị</Text>
                <Pressable onPress={() => nameInputRef.current?.focus()} style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={20} color="#64748B" />
                  <TextInput
                    ref={nameInputRef}
                    autoCapitalize="words"
                    editable={!isSaving}
                    onChangeText={setFullName}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    placeholder="Tên của bạn"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    style={styles.input}
                    textContentType="name"
                    value={fullName}
                  />
                </Pressable>
              </View>

              <View style={styles.passwordBox}>
                <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <Pressable onPress={() => passwordInputRef.current?.focus()} style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={20} color="#64748B" />
                    <TextInput
                      ref={passwordInputRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSaving}
                      onChangeText={setNewPassword}
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                      placeholder="Để trống nếu không đổi"
                      placeholderTextColor="#94A3B8"
                      returnKeyType="next"
                      secureTextEntry={!isPasswordVisible}
                      style={styles.input}
                      textContentType="newPassword"
                      value={newPassword}
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
                  <Text style={styles.label}>Nhập lại mật khẩu mới</Text>
                  <Pressable
                    onPress={() => confirmPasswordInputRef.current?.focus()}
                    style={styles.inputWrap}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" />
                    <TextInput
                      ref={confirmPasswordInputRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSaving}
                      onChangeText={setConfirmPassword}
                      onSubmitEditing={handleSave}
                      placeholder="Xác nhận mật khẩu mới"
                      placeholderTextColor="#94A3B8"
                      returnKeyType="done"
                      secureTextEntry={!isPasswordVisible}
                      style={styles.input}
                      textContentType="newPassword"
                      value={confirmPassword}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                disabled={!canSave}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSave && styles.primaryButtonDisabled,
                  pressed && canSave && styles.primaryButtonPressed,
                ]}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Lưu thay đổi</Text>
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
    elevation: 2,
    overflow: 'hidden',
    padding: 16,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
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
  readOnlyInput: {
    backgroundColor: '#F8FAFC',
  },
  readOnlyText: {
    color: '#475569',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  passwordBox: {
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 14,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
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
