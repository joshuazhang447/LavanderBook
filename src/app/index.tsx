import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

export default function HomeScreen() {
  const [query, setQuery] = React.useState('');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>LavenderBook</CardTitle>
            <CardDescription>Anonymous venue reviews.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <Input placeholder="Search venues" value={query} onChangeText={setQuery} />
            <Button onPress={() => setQuery('')}>
              <Text>Clear</Text>
            </Button>
          </CardContent>
        </Card>

        <Text className="text-sm text-muted-foreground">
          NativeWind + react-native-reusables are wired up.
        </Text>
      </View>
    </SafeAreaView>
  );
}
