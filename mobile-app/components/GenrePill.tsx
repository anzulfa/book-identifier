import { View, Text } from 'react-native';

interface Props {
  label: string;
}

export function GenrePill({ label }: Props) {
  return (
    <View className="rounded-full border border-gold/30 bg-gold/10 px-3 py-0.5">
      <Text className="text-gold text-xs font-medium">{label}</Text>
    </View>
  );
}
