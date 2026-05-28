import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { safeRequest } from '@/utils/safeRequest';
import { supabase } from '@/utils/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dailyGoal, setDailyGoal] = useState('2000');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadProfile() {
        setIsLoading(true);

        const { data: authData } = await supabase.auth
          .getUser()
          .catch(() => ({ data: { user: null } }));
        const user = authData.user;

        if (!user) {
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        const { data: profile } = await safeRequest(
          supabase
            .from('profiles')
            .select('full_name, daily_calorie_goal')
            .eq('id', user.id)
            .maybeSingle(),
          { data: null },
        );

        if (isMounted) {
          setEmail(user.email ?? '');
          setFullName(profile?.full_name ?? '');
          setDailyGoal(String(profile?.daily_calorie_goal ?? 2000));
          setIsLoading(false);
        }
      }

      loadProfile();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  async function logout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    const { error } = await supabase.auth
      .signOut({ scope: 'local' })
      .catch((requestError: Error) => ({ error: requestError }));
    setIsLoggingOut(false);

    if (error) {
      Alert.alert('Đăng xuất thất bại', error.message);
      return;
    }

    router.replace('/login');
  }

  function handleLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi MealScan?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerStripe} />
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Settings</Text>
            <Text style={styles.title}>Cài đặt</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={26} color="#14B8A6" />
          </View>
        </View>
        <Text style={styles.subtitle}>Quản lý tài khoản và tùy chọn MealScan.</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={34} color="#14B8A6" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{fullName || 'Người dùng MealScan'}</Text>
          <Text style={styles.profileEmail}>{email || 'Chưa có email'}</Text>
        </View>
        {isLoading ? <ActivityIndicator color="#14B8A6" /> : null}
      </View>

      <View style={styles.settingsSection}>
        <SettingRow
          icon="person-circle-outline"
          title="Tùy chọn tài khoản"
          subtitle="Đổi mật khẩu và tên hiển thị"
          onPress={() => router.push('/account-options')}
        />
        <SettingRow
          icon="body-outline"
          title="Thông tin thể trạng"
          subtitle={`Mục tiêu hiện tại: ${dailyGoal} kcal/ngày`}
          onPress={() => router.push('/body-profile')}
        />
        <SettingRow
          icon="notifications-outline"
          title="Cài đặt thông báo"
          subtitle="Nhắc nhở bữa ăn và thông báo hằng ngày"
        />
        <SettingRow icon="language-outline" title="Ngôn ngữ" subtitle="Tiếng Việt" />
      </View>

      <Pressable
        disabled={isLoggingOut}
        onPress={handleLogout}
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}>
        {isLoggingOut ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={styles.logoutButtonText}>Đăng xuất</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function SettingRow({
  icon,
  onPress,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color="#14B8A6" />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F0FDFA',
    flex: 1,
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  header: {
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
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
    gap: 16,
    justifyContent: 'space-between',
    width: '100%',
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
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 86,
    padding: 14,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  settingsSection: {
    gap: 10,
  },
  settingRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#CCFBF1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingRowPressed: {
    opacity: 0.76,
  },
  settingIcon: {
    alignItems: 'center',
    backgroundColor: '#ECFEFF',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  settingSubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 3,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fca5a5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 'auto',
    minHeight: 54,
  },
  logoutButtonDisabled: {
    opacity: 0.68,
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '800',
  },
});
