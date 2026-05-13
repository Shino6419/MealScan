import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
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

const FORGOT_PASSWORD_ROUTE = '/forgot-password' as Href;

export default function LoginScreen() {
  const router = useRouter();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleLogin() {
    if (!canSubmit) {
      Alert.alert('Thieu thong tin', 'Vui long nhap email va mat khau.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Dang nhap that bai', error.message);
      return;
    }

    router.replace('/(tabs)');
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
              <Text style={styles.title}>Dang nhap</Text>
            </View>
            <View style={styles.logoMark}>
              <Ionicons name="scan" size={26} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>Theo doi luong calo moi ngay tu mon an cua ban.</Text>
        </View>

        <View style={styles.form}>
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
            <Text style={styles.label}>Mat khau</Text>
            <Pressable onPress={() => passwordInputRef.current?.focus()} style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
              <TextInput
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                placeholder="Nhap mat khau"
                placeholderTextColor="#94a3b8"
                returnKeyType="done"
                secureTextEntry={!isPasswordVisible}
                showSoftInputOnFocus
                style={styles.input}
                textContentType="password"
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

          <Pressable onPress={() => router.push(FORGOT_PASSWORD_ROUTE)} style={styles.forgotButton}>
            <Text style={styles.forgotText}>Quen mat khau?</Text>
          </Pressable>

          <Pressable
            disabled={!canSubmit}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              !canSubmit && styles.loginButtonDisabled,
              pressed && canSubmit && styles.loginButtonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Dang nhap</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/register')} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Chua co tai khoan?</Text>
            <Text style={styles.secondaryLink}>Dang ky</Text>
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
    maxWidth: 320,
  },
  form: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 18,
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
  forgotButton: {
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
  },
  forgotText: {
    color: '#14B8A6',
    fontSize: 14,
    fontWeight: '800',
  },
  loginButton: {
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
  loginButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  loginButtonPressed: {
    opacity: 0.88,
  },
  loginButtonText: {
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
