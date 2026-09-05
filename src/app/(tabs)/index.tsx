import * as React from 'react';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

export default function MapScreen() {
  const [query, setQuery] = React.useState('');

  return (
    <View className="flex-1 bg-background">
      <View className="w-full max-w-md gap-6 self-center px-6 pt-8">
        <Text className="text-3xl font-bold text-foreground">Hello LavenderBook</Text>
        <Input placeholder="Hello World" value={query} onChangeText={setQuery} />
      </View>
    </View>
  );
}
