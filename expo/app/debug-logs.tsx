import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { clearLogs, getEntryCount, getLogText, getSessionId } from '@/lib/appLogger';

export default function DebugLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logText, setLogText] = useState('');
  const [count, setCount] = useState(0);
  const [sharing, setSharing] = useState(false);

  const refresh = useCallback(() => {
    const lines = getLogText().split('\n').filter(Boolean);
    setLogText(lines.reverse().join('\n'));
    setCount(getEntryCount());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const text = getLogText();
      const datePart = new Date().toISOString().slice(0, 10);
      const filename = `elise-diagnostic-${datePart}.txt`;
      if (!cacheDirectory) {
        Alert.alert('Feil', 'Filkatalog er ikke tilgjengelig på denne enheten.');
        return;
      }
      const uri = `${cacheDirectory}${filename}`;
      await writeAsStringAsync(uri, text, {
        encoding: EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Kan ikke dele', 'Deling er ikke tilgjengelig på denne enheten.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Del diagnostikklogg',
      });
    } catch {
      Alert.alert('Feil', 'Kunne ikke eksportere loggen.');
    } finally {
      setSharing(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Tøm logg',
      'Er du sikker på at du vil slette all diagnostikklogg?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Tøm',
          style: 'destructive',
          onPress: async () => {
            await clearLogs();
            refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnostikklogg</Text>
        <Text style={styles.subtitle}>
          {count} linjer · sesjon {getSessionId()}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logText} selectable>
          {logText || 'Ingen logglinjer ennå.'}
        </Text>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleShare}
          disabled={sharing}
          activeOpacity={0.7}
        >
          {sharing ? (
            <ActivityIndicator color={Colors.headerText} />
          ) : (
            <Text style={styles.primaryButtonText}>Del logg</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleClear} activeOpacity={0.7}>
          <Text style={styles.buttonText}>Tøm logg</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>Lukk</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  logText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
    color: Colors.text,
  },
  actions: {
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500' as const,
  },
});
