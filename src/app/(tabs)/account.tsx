import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function AccountScreen() {
  return (
    <View className="flex-1 bg-background">
      <View className="w-full max-w-md gap-3 self-center px-6 pt-8">
        <Text className="text-3xl font-bold text-foreground">My Account</Text>
        <Text className="text-muted-foreground">
          Sign-in and your reviews will live here.
        </Text>
      </View>
    </View>
  );
}
