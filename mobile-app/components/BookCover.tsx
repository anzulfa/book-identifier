import { Image, View, Text } from 'react-native';

interface Props {
  uri?: string | null;
  width?: number;
  height?: number;
}

export function BookCover({ uri, width = 140, height = 210 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width, height, borderRadius: 8 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{ width, height, borderRadius: 8 }}
      className="bg-card items-center justify-center border border-border"
    >
      <Text className="text-4xl mb-1">📖</Text>
      <Text className="text-muted text-xs text-center px-2">No cover</Text>
    </View>
  );
}
