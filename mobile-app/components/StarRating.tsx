import { View, Text } from 'react-native';

interface Props {
  rating: number;
  max?: number;
}

export function StarRating({ rating, max = 5 }: Props) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    if (rating >= i) {
      stars.push('★');
    } else if (rating >= i - 0.5) {
      stars.push('⯨');
    } else {
      stars.push('☆');
    }
  }
  return (
    <View className="flex-row items-center gap-0.5">
      {stars.map((s, i) => (
        <Text key={i} className="text-gold text-base leading-none">
          {s}
        </Text>
      ))}
    </View>
  );
}
