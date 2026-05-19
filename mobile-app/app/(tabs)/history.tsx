import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getHistory, clearHistory, removeFromHistory, HistoryItem } from '@/lib/history';
import { getAuthToken } from '@/lib/storage';
import { Colors } from '@/constants/Colors';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HistoryCard({ item, onRemove }: { item: HistoryItem; onRemove: () => void }) {
  const router = useRouter();

  function open() {
    router.push({
      pathname: '/result',
      params: {
        data: JSON.stringify({
          title: item.title,
          author: item.author,
          year: item.year,
          cover_image_url: item.cover_image_url,
          goodreads_rating: item.goodreads_rating,
          google_rating: item.google_rating,
          genres: item.genres,
        }),
      },
    });
  }

  return (
    <TouchableOpacity
      onPress={open}
      onLongPress={() =>
        Alert.alert('Remove', `Remove "${item.title}" from history?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: onRemove },
        ])
      }
      activeOpacity={0.75}
      className="flex-row items-center bg-card border border-border rounded-2xl px-3 py-3 mb-3"
    >
      {item.cover_image_url ? (
        <Image
          source={{ uri: item.cover_image_url }}
          className="rounded-lg mr-3"
          style={{ width: 48, height: 68, backgroundColor: Colors.border }}
          resizeMode="cover"
        />
      ) : (
        <View
          className="rounded-lg mr-3 items-center justify-center"
          style={{ width: 48, height: 68, backgroundColor: Colors.border }}
        >
          <Text style={{ fontSize: 22 }}>📖</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-cream text-sm font-bold leading-snug" numberOfLines={2}>
          {item.title}
        </Text>
        {item.author ? (
          <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{item.author}</Text>
        ) : null}
        <View className="flex-row items-center gap-2 mt-1">
          {item.year ? <Text className="text-muted text-xs">{item.year}</Text> : null}
          {item.goodreads_rating != null ? (
            <Text className="text-gold text-xs">★ {item.goodreads_rating.toFixed(1)}</Text>
          ) : item.google_rating != null ? (
            <Text className="text-gold text-xs">★ {item.google_rating.toFixed(1)}</Text>
          ) : null}
        </View>
        <Text className="text-muted text-xs mt-1">{formatDate(item.looked_up_at)}</Text>
      </View>

      <Text className="text-muted text-base ml-2">›</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        const token = await getAuthToken();
        if (!active) return;
        if (!token) {
          setSignedIn(false);
          setLoading(false);
          return;
        }
        setSignedIn(true);
        try {
          const data = await getHistory();
          if (active) setItems(data);
        } catch {
          if (active) setItems([]);
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [])
  );

  async function handleClear() {
    Alert.alert('Clear History', 'Remove all history entries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive', onPress: async () => {
          await clearHistory();
          setItems([]);
        },
      },
    ]);
  }

  async function handleRemove(id: number) {
    await removeFromHistory(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (signedIn === false) {
    return (
      <SafeAreaView className="flex-1 bg-stone items-center justify-center px-8" edges={['bottom']}>
        <Text style={{ fontSize: 40 }}>🔒</Text>
        <Text className="text-cream text-lg font-bold mt-4 text-center">Sign in to see history</Text>
        <Text className="text-muted text-sm mt-2 text-center">
          Your lookup history syncs across all your devices when you're signed in.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/sign-in')}
          className="bg-burgundy rounded-2xl py-3.5 px-8 mt-6"
          activeOpacity={0.8}
        >
          <Text className="text-cream font-bold text-base">Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-stone items-center justify-center" edges={['bottom']}>
        <ActivityIndicator color={Colors.gold} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-stone" edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <HistoryCard item={item} onRemove={() => handleRemove(item.id)} />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center pt-24">
            <Text style={{ fontSize: 40 }}>📚</Text>
            <Text className="text-cream text-base font-semibold mt-4">No history yet</Text>
            <Text className="text-muted text-sm mt-1 text-center px-8">
              Books you identify will appear here.
            </Text>
          </View>
        }
        ListHeaderComponent={
          items.length > 0 ? (
            <TouchableOpacity onPress={handleClear} className="items-end mb-3">
              <Text className="text-muted text-xs">Clear all</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
