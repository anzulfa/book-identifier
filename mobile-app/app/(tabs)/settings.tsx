import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getBackendUrl, setBackendUrl } from '@/lib/storage';
import Constants from 'expo-constants';
import { Colors } from '@/constants/Colors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-gold text-xs font-bold uppercase tracking-widest mb-2 px-1">
        {title}
      </Text>
      <View className="bg-card rounded-2xl border border-border overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between px-4 py-3.5 ${!last ? 'border-b border-border' : ''}`}>
      <Text className="text-cream text-sm">{label}</Text>
      {value && <Text className="text-muted text-sm">{value}</Text>}
    </View>
  );
}

export default function SettingsScreen() {
  const [backendUrl, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBackendUrl().then(setUrl);
  }, []);

  async function save() {
    if (!backendUrl.startsWith('http')) {
      Alert.alert('Invalid URL', 'Backend URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      await setBackendUrl(backendUrl);
      Alert.alert('Saved', 'Backend URL updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-stone"
    >
      <ScrollView className="flex-1 px-4 pt-6" keyboardShouldPersistTaps="handled">
        <Section title="App">
          <View className="px-4 py-3 border-b border-border">
            <Text className="text-cream text-sm mb-1.5">Backend URL</Text>
            <TextInput
              value={backendUrl}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://your-backend.railway.app"
              placeholderTextColor={Colors.muted}
              className="text-cream text-sm"
              style={{ color: Colors.cream }}
            />
          </View>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className="px-4 py-3.5 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-gold font-semibold text-sm">
              {saving ? 'Saving…' : 'Save Backend URL'}
            </Text>
          </TouchableOpacity>
        </Section>

        <Section title="About">
          <Row label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <Row label="Privacy Policy" last />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
