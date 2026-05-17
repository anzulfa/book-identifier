import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useBookLookup } from '@/hooks/useBookLookup';
import { RateLimitError } from '@/lib/api';
import { Colors } from '@/constants/Colors';

export default function HomeScreen() {
  const router = useRouter();
  const { mutateAsync, isPending } = useBookLookup();
  const [loading, setLoading] = useState(false);

  async function handleImage(base64: string) {
    setLoading(true);
    try {
      const result = await mutateAsync(`data:image/jpeg;base64,${base64}`);
      router.push({ pathname: '/result', params: { data: JSON.stringify(result) } });
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        Alert.alert(
          'Daily limit reached',
          err.message + '\n\nUpgrade to premium for unlimited lookups.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', err.message ?? 'Could not identify book.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function toJpegBase64(uri: string): Promise<string> {
    const { base64 } = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return base64!;
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      await handleImage(await toJpegBase64(result.assets[0].uri));
    }
  }

  async function uploadImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      await handleImage(await toJpegBase64(result.assets[0].uri));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-stone">
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-gold text-3xl font-bold tracking-tight">📖 Book Identifier</Text>
        <Text className="text-muted text-sm mt-2 leading-5">
          Point your camera at any book cover or title to instantly identify it.
        </Text>
      </View>

      {/* Buttons */}
      <View className="flex-1 justify-center px-6 gap-4">
        <TouchableOpacity
          onPress={takePhoto}
          disabled={loading}
          className="bg-burgundy rounded-2xl py-5 items-center flex-row justify-center gap-3"
          activeOpacity={0.8}
        >
          <Text className="text-2xl">📷</Text>
          <Text className="text-cream text-lg font-bold">Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={uploadImage}
          disabled={loading}
          className="rounded-2xl py-5 items-center flex-row justify-center gap-3 border-2 border-gold/50"
          activeOpacity={0.8}
        >
          <Text className="text-2xl">🖼</Text>
          <Text className="text-gold text-lg font-bold">Upload Image</Text>
        </TouchableOpacity>
      </View>

      {/* Footer hint */}
      <View className="px-6 pb-8">
        <Text className="text-muted text-xs text-center">
          Works best with clear photos of book covers or titles.
        </Text>
      </View>

      {/* Loading overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View className="flex-1 bg-stone/90 items-center justify-center gap-4">
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text className="text-cream text-base font-semibold">Identifying book…</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
