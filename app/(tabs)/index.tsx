import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Text,
  Platform,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';
import Colors from '@/constants/colors';

type WebViewRef = {
  injectJavaScript: (script: string) => void;
  clearCache?: (clear: boolean) => void;
  clearHistory?: () => void;
  reload: () => void;
};

let WebView: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

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

export default function PowerAppsScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebViewRef | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const [useIncognito] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(getAuthUrl());
    }
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logg ut',
      'Er du sikker på at du vil logge ut?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logg ut',
          style: 'destructive',
          onPress: () => {
            console.log('Starting full logout sequence...');
            setError(null);
            setLogoutComplete(false);
            setUserName(null);
            
            // Clear all storage and cookies aggressively
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                (function() {
                  try {
                    // Clear all storage
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // Clear all cookies for all domains
                    var cookies = document.cookie.split(";");
                    for (var i = 0; i < cookies.length; i++) {
                      var cookie = cookies[i];
                      var eqPos = cookie.indexOf("=");
                      var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.microsoft.com";
                      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.microsoftonline.com";
                      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.powerapps.com";
                      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.live.com";
                    }
                    
                    // Clear IndexedDB
                    if (window.indexedDB) {
                      indexedDB.databases().then(function(dbs) {
                        dbs.forEach(function(db) { indexedDB.deleteDatabase(db.name); });
                      }).catch(function() {});
                    }
                    
                    // Clear caches
                    if (window.caches) {
                      caches.keys().then(function(names) {
                        names.forEach(function(name) { caches.delete(name); });
                      }).catch(function() {});
                    }
                  } catch(e) { console.log('Clear error:', e); }
                })();
                true;
              `);
              
              // Clear WebView cache
              webViewRef.current.clearCache?.(true);
              webViewRef.current.clearHistory?.();
            }
            
            // Start logout process
            setIsLoggingOut(true);
            setKey(prev => prev + 1);
          },
        },
      ]
    );
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
      var foundUser = false;
      
      function sendUserName(name) {
        if (name && name.trim() && !foundUser) {
          var cleanName = name.trim().replace(/\\s+/g, ' ');
          if (cleanName.length > 1 && cleanName.length < 100) {
            foundUser = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'userName', value: cleanName }));
          }
        }
      }
      
      function extractUserInfo() {
        try {
          // PowerApps player header selectors
          var selectors = [
            '[data-automation-id="personaName"]',
            '.ms-Persona-primaryText',
            '.ms-Persona-details .ms-Persona-primaryText',
            '#mectrl_currentAccount_primary',
            '#mectrl_headerPicture',
            '[data-testid="profile-card-name"]',
            '.o365cs-me-tile-name',
            '.mectrl_currentAccount_primary',
            '[aria-label*="Account manager"]',
            '.pa-player-header [class*="name"]',
            '[class*="userProfile"] [class*="name"]',
            '[class*="UserProfile"] [class*="Name"]',
            '#O365_MainLink_MePhoto',
            '.ms-CommandBar [class*="persona"]',
            '[data-automationid="splitbuttonprimary"]',
          ];
          
          for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) {
              var name = el.textContent || el.getAttribute('aria-label') || el.getAttribute('title');
              if (name) {
                sendUserName(name);
                return;
              }
            }
          }
          
          // Try to get from MSAL account info in localStorage/sessionStorage
          try {
            var keys = Object.keys(sessionStorage).concat(Object.keys(localStorage));
            for (var k = 0; k < keys.length; k++) {
              var key = keys[k];
              if (key.includes('login.windows.net') || key.includes('msal') || key.includes('account')) {
                var val = sessionStorage.getItem(key) || localStorage.getItem(key);
                if (val) {
                  var parsed = JSON.parse(val);
                  if (parsed.name) { sendUserName(parsed.name); return; }
                  if (parsed.username) { sendUserName(parsed.username); return; }
                  if (parsed.preferred_username) { sendUserName(parsed.preferred_username); return; }
                }
              }
            }
          } catch(e) {}
          
        } catch(e) {
          console.log('Extract user error:', e);
        }
      }
      
      // MutationObserver to detect when user info appears
      var observer = new MutationObserver(function(mutations) {
        if (!foundUser) extractUserInfo();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Run periodically
      setTimeout(extractUserInfo, 1000);
      setTimeout(extractUserInfo, 3000);
      setTimeout(extractUserInfo, 6000);
      setTimeout(extractUserInfo, 10000);
      setInterval(function() { if (!foundUser) extractUserInfo(); }, 5000);
      
      true;
    })();
  `;

  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const url = request.url;
    console.log('Navigation request:', url);
    
    // Allow Microsoft auth URLs
    if (
      url.includes('login.microsoftonline.com') ||
      url.includes('login.live.com') ||
      url.includes('powerapps.com') ||
      url.includes('microsoft.com') ||
      url.includes('msftauth') ||
      url.includes('office.com') ||
      url.includes('azure.com')
    ) {
      return true;
    }
    
    return true;
  }, []);





  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.headerBackground} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {userName && <Text style={styles.userText} numberOfLines={1}>{userName}</Text>}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LogOut size={18} color="#e3eaf3" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.webViewContainer, { paddingBottom: insets.bottom }]}>
        {Platform.OS === 'web' ? null : logoutComplete ? (
          <View style={styles.logoutCompleteContainer}>
            <Text style={styles.logoutCompleteTitle}>Du er logget ut</Text>
            <Text style={styles.logoutCompleteText}>Utloggingen er fullført. Du kan nå lukke appen.</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setError(null); webViewRef.current?.reload(); }}>
              <Text style={styles.retryButtonText}>Prøv igjen</Text>
            </TouchableOpacity>
          </View>
        ) : WebView ? (
          <>
            <WebView
              key={key}
              ref={webViewRef}
              source={{ uri: isLoggingOut 
                ? 'https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=' + encodeURIComponent('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=00000000-0000-0000-0000-000000000000&response_type=code&prompt=select_account')
                : getAuthUrl() }}
              style={styles.webView}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleError}
              injectedJavaScript={injectedJavaScript}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={false}
              incognito={isLoggingOut ? true : useIncognito}
              cacheEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              mixedContentMode="always"
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              userAgent={Platform.OS === 'android' ? 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' : undefined}
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures={true}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onMessage={(event: { nativeEvent: { data: string } }) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'userName' && data.value) {
                    console.log('Received userName:', data.value);
                    setUserName(data.value);
                  }
                } catch (e) {
                  console.log('Message parse error:', e);
                }
              }}
              originWhitelist={['*']}
              onNavigationStateChange={(navState: { url: string; loading?: boolean }) => {
                console.log('Navigation:', navState.url);
                
                // After logout completes, reload with fresh login prompt
                if (isLoggingOut) {
                  // Check if we've completed logout flow
                  if (navState.url.includes('logout') || 
                      navState.url.includes('loggedout') || 
                      navState.url.includes('login.microsoftonline.com') ||
                      navState.url.includes('login.live.com')) {
                    console.log('Logout in progress...');
                  }
                  
                  // If logout session completed or redirected to login page
                  if (navState.url.includes('logoutsession') || 
                      navState.url.includes('signout') ||
                      navState.url.includes('select_account') ||
                      navState.url.includes('/authorize') ||
                      (navState.loading === false && navState.url.includes('microsoftonline.com') && !navState.url.includes('logout'))) {
                    console.log('Logout complete, closing app');
                    setTimeout(() => {
                      setIsLoggingOut(false);
                      // Automatically close app on Android after logout
                      if (Platform.OS === 'android') {
                        BackHandler.exitApp();
                      } else {
                        // On iOS, show completion screen since we can't close the app
                        setLogoutComplete(true);
                      }
                    }, 1000);
                  }
                }
              }}
            />
          </>
        ) : null}
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

  userText: {
    color: '#e3eaf3',
    fontSize: 14,
    fontWeight: '500' as const,
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
  logoutCompleteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  logoutCompleteTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  logoutCompleteText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },

});
