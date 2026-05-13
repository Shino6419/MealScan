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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const emailInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = email.trim();
  const canSubmit = normalizedEmail.length > 0 && !isSubmitting;

  async function handleSendResetEmail() {
    if (!canSubmit) {
      Alert.alert('Thieu email', 'Vui long nhap email tai khoan cua ban.');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Gui email that bai', error.message);
      return;
    }

    Alert.alert(
      'Da gui email',
      'Neu email ton tai trong he thong, ban se nhan duoc lien ket dat lai mat khau.',
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
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
          <Text style={styles.backText}>Quay lai</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerStripe} />
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.kicker}>MealScan</Text>
              <Text style={styles.title}>Quen mat khau</Text>
            </View>
            <View style={styles.logoMark}>
              <Ionicons name="key-outline" size={26} color="#14B8A6" />
            </View>
          </View>
          <Text style={styles.subtitle}>
            Nhap email da dang ky de nhan lien ket dat lai mat khau.
          </Text>
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
                onSubmitEditing={handleSendResetEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                returnKeyType="send"
                showSoftInputOnFocus
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </Pressable>
          </View>

          <Pressable
            disabled={!canSubmit}
            onPress={handleSendResetEmail}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit && styles.primaryButtonDisabled,
              pressed && canSubmit && styles.primaryButtonPressed,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Gui email dat lai mat khau</Text>
                <Ionicons name="send-outline" size={20} color="#fff" />
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Da nho mat khau?</Text>
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
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    left: 18,
    minHeight: 40,
    position: 'absolute',
    top: 48,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#14B8A6',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
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
