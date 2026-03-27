import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import Colors from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Ikke funnet' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Siden finnes ikke</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Gå til startsiden</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 16,
    color: Colors.headerText,
    fontWeight: '500' as const,
  },
});
