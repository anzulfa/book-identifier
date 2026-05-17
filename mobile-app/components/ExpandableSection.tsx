import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  title: string;
  children: React.ReactNode;
}

export function ExpandableSection({ title, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View className="border-t border-border pt-3">
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        className="flex-row items-center justify-between pb-2"
        activeOpacity={0.7}
      >
        <Text className="text-gold text-xs font-bold tracking-widest uppercase">
          {title}
        </Text>
        <Text className="text-muted text-sm">{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <Text className="text-cream/80 text-sm leading-relaxed pb-2">
          {children}
        </Text>
      )}
    </View>
  );
}
