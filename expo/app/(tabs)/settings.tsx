import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shield, ExternalLink, Info, Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const openPrivacyPolicy = () => {
    Linking.openURL('https://privacy.microsoft.com/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Innstillinger</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Om appen</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Shield size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Sikkerhet</Text>
                <Text style={styles.infoValue}>Tvungen pålogging aktivert</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Lock size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Autentisering</Text>
                <Text style={styles.infoValue}>Microsoft Azure AD</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Info size={20} color={Colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Versjon</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lenker</Text>
          <TouchableOpacity style={styles.linkCard} onPress={openPrivacyPolicy} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <ExternalLink size={20} color={Colors.primary} />
              <Text style={styles.linkText}>Personvernerklæring</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Denne appen krever at du logger inn med dine Microsoft-legitimasjoner hver gang du åpner den. 
            Dette sikrer at kun autoriserte brukere får tilgang til Power Apps-innholdet.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 70,
  },
  linkCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  infoSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: `${Colors.primary}10`,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
