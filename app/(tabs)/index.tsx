import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Text,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';

const POWER_APPS_BASE_URL = 'https://apps.powerapps.com/play/e/51da13ed-bad2-4891-acdf-06d3184e6af1/a/f9c26727-72ed-468b-89c2-4e06ee09c3d8?tenantId=fb7e0b12-d8fc-4f14-bd1a-ad9c8667a7e6&hint=052fe12c-09c4-4ebe-8a83-abe82ae742cc&sourcetime=1770037641252&skipMobileRedirect=1&hidenavbar=true';

const getAuthUrl = () => {
  const url = new URL(POWER_APPS_BASE_URL);
  url.searchParams.set('prompt', 'login');
  url.searchParams.set('login_hint', '');
  url.searchParams.set('hideNavBar', 'true');
  url.searchParams.set('skipMobileRedirect', '1');
  url.searchParams.set('source', 'iframe');
  return url.toString();
};

// Redirect immediately on web before component renders
if (typeof window !== 'undefined' && Platform.OS === 'web') {
  window.location.replace(getAuthUrl());
}

export default function PowerAppsScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logg ut',
      'Er du sikker på at du vil logge ut? Du vil bli bedt om å logge inn på nytt.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logg ut',
          style: 'destructive',
          onPress: () => {
            console.log('Logging out and clearing session...');
            setIsLoading(true);
            setError(null);
            setKey(prev => prev + 1);
          },
        },
      ]
    );
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('Refreshing WebView...');
    setError(null);
    webViewRef.current?.reload();
  }, []);

  const handleLoadEnd = useCallback(() => {
    console.log('WebView loaded successfully');
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Kunne ikke laste appen. Sjekk internettforbindelsen din.');
  }, []);

  const injectedJavaScript = `
    (function() {
      // Clear any stored credentials on load
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
      // Prevent caching
      var meta = document.createElement('meta');
      meta.httpEquiv = 'Cache-Control';
      meta.content = 'no-cache, no-store, must-revalidate';
      document.head.appendChild(meta);
      true;
    })();
  `;





  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.headerBackground} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>😊</Text>
          <Text style={styles.userText}>Innlogget: bruker</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={20} color={Colors.headerText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={18} color={Colors.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.webViewContainer}>
        {Platform.OS === 'web' ? null : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Prøv igjen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <WebView
              key={key}
              ref={webViewRef}
              source={{ uri: getAuthUrl() }}
              style={styles.webView}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleError}
              injectedJavaScript={injectedJavaScript}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={false}
              cacheEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              allowsBackForwardNavigationGestures={true}
              keyboardDisplayRequiresUserAction={false}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.headerBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.headerBackground,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 28,
  },
  userText: {
    color: Colors.headerText,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webView: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.headerText,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  webFallbackTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  webFallbackText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  openBrowserButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  openBrowserButtonText: {
    color: Colors.headerText,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
