import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { safeRequest } from '@/utils/safeRequest';
import { supabase } from '@/utils/supabase';
import type { Session } from '@supabase/supabase-js';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

LogBox.ignoreLogs(['TypeError: Network request failed']);

type BodyProfileStatus = {
  age_years: number | null;
  fitness_goal: string | null;
  gender: string | null;
  height_cm: number | null;
  protein_goal_g: number | null;
  tdee_calories: number | null;
  weight_kg: number | null;
};

function hasCompletedBodyProfile(profile: BodyProfileStatus | null) {
  return Boolean(
    profile?.age_years &&
      profile.gender &&
      profile.height_cm &&
      profile.protein_goal_g &&
      profile.tdee_calories &&
      profile.weight_kg &&
      profile.fitness_goal,
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setIsCheckingSession(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isCheckingSession) {
      return;
    }

    const isAuthRoute =
      pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    const isBodyProfileRoute = pathname === '/body-profile';

    if (!session && !isAuthRoute) {
      router.replace('/login');
      return;
    }

    if (!session) {
      return;
    }

    const activeSession = session;
    let isActive = true;

    async function routeAuthenticatedUser() {
      const { data: profile } = await safeRequest(
        supabase
          .from('profiles')
          .select('age_years, gender, height_cm, weight_kg, fitness_goal, tdee_calories, protein_goal_g')
          .eq('id', activeSession.user.id)
          .maybeSingle(),
        { data: null },
      );

      if (!isActive) {
        return;
      }

      const isComplete = hasCompletedBodyProfile(profile as BodyProfileStatus | null);

      if (!isComplete && !isBodyProfileRoute) {
        router.replace('/body-profile');
        return;
      }

      if (isComplete && isAuthRoute) {
        router.replace('/(tabs)');
      }
    }

    routeAuthenticatedUser();

    return () => {
      isActive = false;
    };
  }, [isCheckingSession, pathname, router, session]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
