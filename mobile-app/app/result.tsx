import { ScrollView, View, Text, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookCover } from '@/components/BookCover';
import { StarRating } from '@/components/StarRating';
import { GenrePill } from '@/components/GenrePill';
import { ExpandableSection } from '@/components/ExpandableSection';
import { BookResult } from '@/lib/api';

function formatCount(n?: number | null): string {
  if (!n) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

export default function ResultScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-stone items-center justify-center">
        <Text className="text-muted">No result data.</Text>
      </SafeAreaView>
    );
  }

  let book: BookResult;
  try {
    book = JSON.parse(data);
  } catch {
    return (
      <SafeAreaView className="flex-1 bg-stone items-center justify-center">
        <Text className="text-muted">Could not load result.</Text>
      </SafeAreaView>
    );
  }

  async function share() {
    try {
      await Share.share({
        message: `${book.title}${book.author ? ` by ${book.author}` : ''}${book.year ? ` (${book.year})` : ''} — identified with Book Identifier`,
      });
    } catch {}
  }

  return (
    <SafeAreaView className="flex-1 bg-stone">
      {/* Header bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-gold text-base">← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={share} className="p-1">
          <Text className="text-gold text-base">Share ↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Cover */}
        <View className="items-center pt-6 pb-4 px-6">
          <BookCover uri={book.cover_image_url} width={160} height={240} />
        </View>

        {/* Title / Author / Meta */}
        <View className="px-6 pb-2">
          <Text className="text-cream text-2xl font-bold leading-tight mb-1">
            {book.title}
          </Text>
          {book.author ? (
            <Text className="text-muted text-base mb-3">{book.author}</Text>
          ) : null}

          {/* Year + genres */}
          <View className="flex-row flex-wrap items-center gap-2 mb-4">
            {book.year ? (
              <Text className="text-muted text-sm">{book.year}</Text>
            ) : null}
            {book.genres?.map(g => <GenrePill key={g} label={g} />)}
          </View>

          {/* Ratings */}
          <View className="bg-card rounded-2xl border border-border px-4 py-3 gap-3 mb-4">
            {book.goodreads_rating != null && (
              <View className="flex-row items-center gap-2">
                <StarRating rating={book.goodreads_rating} />
                <Text className="text-cream font-bold text-base">
                  {book.goodreads_rating.toFixed(1)}
                </Text>
                <Text className="text-muted text-xs">/ 5</Text>
                <View className="bg-muted/20 rounded px-1.5 py-0.5">
                  <Text className="text-muted text-xs">Goodreads</Text>
                </View>
                {book.goodreads_ratings_count != null && (
                  <Text className="text-muted text-xs">
                    {formatCount(book.goodreads_ratings_count)} ratings
                  </Text>
                )}
              </View>
            )}
            {book.google_rating != null && (
              <View className="flex-row items-center gap-2">
                <StarRating rating={book.google_rating} />
                <Text className="text-cream font-bold text-base">
                  {book.google_rating.toFixed(1)}
                </Text>
                <Text className="text-muted text-xs">/ 5</Text>
                <View className="bg-muted/20 rounded px-1.5 py-0.5">
                  <Text className="text-muted text-xs">Google</Text>
                </View>
                {book.google_ratings_count != null && (
                  <Text className="text-muted text-xs">
                    {formatCount(book.google_ratings_count)} ratings
                  </Text>
                )}
              </View>
            )}
            {book.goodreads_rating == null && book.google_rating == null && (
              <Text className="text-muted text-sm">No ratings available</Text>
            )}
          </View>

          {/* Expandable sections */}
          <View className="gap-3">
            {book.plot_summary ? (
              <ExpandableSection title="Plot Summary">
                {book.plot_summary}
              </ExpandableSection>
            ) : null}
            {book.reviews_summary ? (
              <ExpandableSection title="Reader Reviews">
                {book.reviews_summary}
              </ExpandableSection>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
