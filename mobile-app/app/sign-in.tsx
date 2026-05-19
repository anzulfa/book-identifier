import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { authLogin, authRegister, authGoogle } from '@/lib/api';
import { setAuthToken } from '@/lib/storage';
import { Colors } from '@/constants/Colors';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID: string = Constants.expoConfig?.extra?.googleWebClientId;
const IOS_CLIENT_ID: string = Constants.expoConfig?.extra?.googleIosClientId;
const ANDROID_CLIENT_ID: string = Constants.expoConfig?.extra?.googleAndroidClientId;

export default function SignInScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleGoogleToken(token);
    }
  }, [response]);

  async function handleGoogleToken(accessToken: string) {
    setGoogleLoading(true);
    try {
      const result = await authGoogle(accessToken);
      await setAuthToken(result.access_token);
      router.back();
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err.message ?? 'Something went wrong.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await authLogin(email.trim(), password)
        : await authRegister(email.trim(), password, name.trim() || undefined);
      await setAuthToken(result.access_token);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-stone">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 48, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-gold text-base">← Back</Text>
          </TouchableOpacity>

          <Text className="text-cream text-3xl font-bold mb-2">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
          <Text className="text-muted text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to unlock more daily lookups.'
              : 'Create a free account to get started.'}
          </Text>

          {/* Google button */}
          <TouchableOpacity
            onPress={() => promptAsync()}
            disabled={!request || googleLoading}
            className="bg-card border border-border rounded-2xl py-4 items-center flex-row justify-center gap-3 mb-4"
            activeOpacity={0.8}
          >
            {googleLoading
              ? <ActivityIndicator color={Colors.cream} />
              : <>
                  <Text className="text-lg">G</Text>
                  <Text className="text-cream text-base font-semibold">Continue with Google</Text>
                </>}
          </TouchableOpacity>

          <View className="flex-row items-center gap-3 mb-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-muted text-xs">or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {mode === 'register' && (
            <View className="mb-4">
              <Text className="text-muted text-xs uppercase tracking-widest mb-1.5">Name (optional)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={Colors.muted}
                autoComplete="name"
                className="bg-card border border-border rounded-xl px-4 py-3.5"
                style={{ color: Colors.cream }}
              />
            </View>
          )}

          <View className="mb-4">
            <Text className="text-muted text-xs uppercase tracking-widest mb-1.5">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              className="bg-card border border-border rounded-xl px-4 py-3.5"
              style={{ color: Colors.cream }}
            />
          </View>

          <View className="mb-8">
            <Text className="text-muted text-xs uppercase tracking-widest mb-1.5">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
              placeholderTextColor={Colors.muted}
              secureTextEntry
              maxLength={72}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="bg-card border border-border rounded-xl px-4 py-3.5"
              style={{ color: Colors.cream }}
            />
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            className="bg-burgundy rounded-2xl py-4 items-center mb-4"
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={Colors.cream} />
              : <Text className="text-cream text-base font-bold">
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="items-center py-2"
          >
            <Text className="text-muted text-sm">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text className="text-gold">
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
