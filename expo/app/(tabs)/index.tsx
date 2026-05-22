import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  StatusBar,
  Text,
  Platform,
  BackHandler,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { LogOut } from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  type LogLevel,
} from '@/lib/appLogger';
import { redactUrl } from '@/lib/redactUrl';
import {
  logMemorySnapshot,
  recordRenderProcessGone,
} from '@/lib/memoryDiagnostics';

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
const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 4 * 60;

const getAuthUrl = () => {
  const url = new URL(POWER_APPS_BASE_URL);
  url.searchParams.set('prompt', 'login');
  url.searchParams.set('login_hint', '');
  url.searchParams.set('hideNavBar', 'true');
  url.searchParams.set('skipMobileRedirect', '1');
  url.searchParams.set('source', 'iframe');
  return url.toString();
};

const DIAGNOSTIC_TAP_COUNT = 7;
const DIAGNOSTIC_TAP_WINDOW_MS = 2000;
const RENDER_PROCESS_GONE_RECOVERY_DELAY_MS = 500;

export default function PowerAppsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebViewRef | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wentBackgroundAtRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number>(Date.now());
  const diagnosticTapCountRef = useRef(0);
  const diagnosticTapWindowRef = useRef(0);
  const renderProcessGoneRecoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configuredTimeoutMinutes = Number(Constants.expoConfig?.extra?.inactivityTimeoutMinutes);
  const inactivityTimeoutMinutes = Number.isFinite(configuredTimeoutMinutes) && configuredTimeoutMinutes > 0
    ? configuredTimeoutMinutes
    : DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  const sessionResetAfterMs = inactivityTimeoutMinutes * 60 * 1000;
  
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [key, setKey] = useState(0);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  const handleDiagnosticHeaderPress = useCallback(() => {
    const now = Date.now();
    if (now - diagnosticTapWindowRef.current > DIAGNOSTIC_TAP_WINDOW_MS) {
      diagnosticTapCountRef.current = 0;
    }
    diagnosticTapWindowRef.current = now;
    diagnosticTapCountRef.current += 1;
    if (diagnosticTapCountRef.current >= DIAGNOSTIC_TAP_COUNT) {
      diagnosticTapCountRef.current = 0;
      logInfo('app', 'Diagnostics opened');
      router.push('/debug-logs');
    }
  }, [router]);

  const performHardLogout = useCallback((reason: string) => {
    logInfo('session', 'Starting hard logout', { reason });
    setError(null);
    setLogoutComplete(false);
    setUserName(null);

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            localStorage.clear();
            sessionStorage.clear();
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
            if (window.indexedDB) {
              indexedDB.databases().then(function(dbs) {
                dbs.forEach(function(db) { indexedDB.deleteDatabase(db.name); });
              }).catch(function() {});
            }
            if (window.caches) {
              caches.keys().then(function(names) {
                names.forEach(function(name) { caches.delete(name); });
              }).catch(function() {});
            }
          } catch (e) {}
          true;
        })();
      `);
      webViewRef.current.clearCache?.(true);
      webViewRef.current.clearHistory?.();
    }

    setIsLoggingOut(true);
    setKey(prev => prev + 1);
  }, []);

  const resetSession = useCallback((reason: string) => {
    logInfo('session', 'Resetting WebView session', { reason });
    if (reason.includes('render-process-gone')) {
      logMemorySnapshot('Recovery after render process gone', { reason });
    }
    setError(null);
    setIsRecovering(false);
    setIsLoggingOut(false);
    setLogoutComplete(false);
    setUserName(null);
    setKey(prev => prev + 1);
  }, []);

  const handleRenderProcessGone = useCallback(
    (event?: { nativeEvent?: { didCrash?: boolean } }) => {
      const didCrash = event?.nativeEvent?.didCrash;
      const { shouldAutoRecover, count, autoRestartsInWindow } =
        recordRenderProcessGone(didCrash);

      if (!shouldAutoRecover) {
        logError('webview', 'Render process gone rate limit exceeded', {
          count,
          autoRestartsInWindow,
        });
        setIsRecovering(false);
        setError(
          'Appen mistet forbindelsen. Trykk "Start ny sesjon" for å laste på nytt.',
        );
        return;
      }

      setIsRecovering(true);
      if (renderProcessGoneRecoveryTimeoutRef.current) {
        clearTimeout(renderProcessGoneRecoveryTimeoutRef.current);
      }
      renderProcessGoneRecoveryTimeoutRef.current = setTimeout(() => {
        renderProcessGoneRecoveryTimeoutRef.current = null;
        resetSession('render-process-gone-auto');
      }, RENDER_PROCESS_GONE_RECOVERY_DELAY_MS);
    },
    [resetSession],
  );

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(getAuthUrl());
    }
  }, []);

  useEffect(() => {
    logInfo('app', 'PowerApps screen mounted', {
      inactivityTimeoutMinutes,
      platform: Platform.OS,
    });
    return () => {
      if (renderProcessGoneRecoveryTimeoutRef.current) {
        clearTimeout(renderProcessGoneRecoveryTimeoutRef.current);
      }
    };
  }, [inactivityTimeoutMinutes]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        wentBackgroundAtRef.current = Date.now();
        logInfo('appState', 'App went to background', { state: nextAppState });
        logMemorySnapshot('App backgrounded', { state: nextAppState });
        return;
      }

      if (nextAppState === 'active' && logoutComplete) {
        logInfo('appState', 'Resume after logout complete');
        resetSession('resume-after-logout');
        return;
      }

      if ((prevState === 'background' || prevState === 'inactive') && nextAppState === 'active') {
        const sleptMs = wentBackgroundAtRef.current ? Date.now() - wentBackgroundAtRef.current : 0;
        const idleMs = Date.now() - lastInteractionAtRef.current;
        logInfo('appState', 'App returned to foreground', { sleptMs, idleMs, prevState });
        if (sleptMs >= 60000) {
          logMemorySnapshot('Long background resume', { sleptMs, idleMs, prevState });
        }
        if (sleptMs >= sessionResetAfterMs) {
          performHardLogout('inactive-timeout');
          return;
        }
        if (sleptMs < 30000) return;

        // Short inactivity can also leave Power Apps in a stale state.
        // Ask the page for a health signal and reset when timeout/error text is present.
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`
            (function() {
              function sampleBad() {
                try {
                  var txt = ((document.body && document.body.innerText) || '').toLowerCase();
                  var bad = [
                    "this app isn't working",
                    "denne appen fungerer ikke",
                    "session expired",
                    "økt utløpt"
                  ];
                  return bad.some(function(p) { return txt.indexOf(p) !== -1; });
                } catch (e) { return false; }
              }
              setTimeout(function() {
                var first = sampleBad();
                setTimeout(function() {
                  var second = sampleBad();
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'resumeHealth',
                    hasBad: first && second,
                    url: location.href
                  }));
                }, 2200);
              }, 400);
              true;
            })();
          `);
        }, 1200);
      }
    });
    return () => subscription.remove();
  }, [logoutComplete, performHardLogout, resetSession, sessionResetAfterMs]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const checkInterval = setInterval(() => {
      if (appStateRef.current !== 'active' || isLoggingOut || logoutComplete) return;
      const idleMs = Date.now() - lastInteractionAtRef.current;
      if (idleMs >= sessionResetAfterMs) {
        logWarn('session', 'Foreground idle timeout', { idleMs });
        performHardLogout('foreground-idle-timeout');
      }
    }, 15000);
    return () => clearInterval(checkInterval);
  }, [isLoggingOut, logoutComplete, performHardLogout, sessionResetAfterMs]);

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
            performHardLogout('manual');
          },
        },
      ]
    );
  }, [performHardLogout]);



  const handleLoadStart = useCallback(() => {
    logInfo('webview', 'WebView load started');
  }, []);

  const handleLoadEnd = useCallback(() => {
    logInfo('webview', 'WebView load ended');
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    logError('webview', 'WebView error', {
      description: nativeEvent?.description,
      code: nativeEvent?.code,
      url: nativeEvent?.url ? redactUrl(nativeEvent.url) : undefined,
    });
    setError('Kunne ikke laste appen. Sjekk internettforbindelsen din.');
  }, []);

  const handleWebViewLog = useCallback((level: string, message: string, data?: unknown) => {
    const normalized = (level || 'info') as LogLevel;
    if (normalized === 'error') {
      logError('webview', message, data);
    } else if (normalized === 'warn') {
      logWarn('webview', message, data);
    } else if (normalized === 'debug') {
      logDebug('webview', message, data);
    } else {
      logInfo('webview', message, data);
    }
  }, []);

  const injectedJavaScript = `
    (function() {
      var confirmedUser = false;
      var reportedSessionIssue = false;

      function wvLog(level, message, data) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'webviewLog',
            level: level || 'info',
            message: message || '',
            data: data
          }));
        } catch (e) {}
      }
      
      var badPhrases = [
        'skip to main content', 'skip to content', 'skip navigation',
        'hopp til hovedinnhold', 'gå til hovedinnhold', 'gå til innhold',
        'hopp til innhold', 'main content', 'hovedinnhold',
        'sign in', 'logg inn', 'log in', 'loading', 'laster',
        'power apps', 'powerapps', 'undefined', 'null'
      ];

      function isValidName(str) {
        if (!str) return false;
        var clean = str.trim().replace(/\\s+/g, ' ');
        if (clean.length < 2 || clean.length > 80) return false;
        var lower = clean.toLowerCase();
        for (var i = 0; i < badPhrases.length; i++) {
          if (lower === badPhrases[i] || lower.indexOf(badPhrases[i]) !== -1) return false;
        }
        if (/^[^a-zA-ZæøåÆØÅéèêëàâäüöïîôùûç]/.test(clean)) return false;
        if (clean.indexOf('@') !== -1 && !clean.match(/^[^@]+@[^@]+\\.[^@]+$/)) return false;
        return true;
      }

      function sendUserName(name) {
        if (!name) return;
        var cleanName = name.trim().replace(/\\s+/g, ' ');
        if (!isValidName(cleanName)) return;
        confirmedUser = true;
        wvLog('info', 'User name confirmed');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'userName', value: cleanName }));
      }
      
      function extractFromMSAL() {
        try {
          var storages = [sessionStorage, localStorage];
          for (var s = 0; s < storages.length; s++) {
            var store = storages[s];
            var keys = Object.keys(store);
            for (var k = 0; k < keys.length; k++) {
              var key = keys[k];
              if (key.indexOf('login.windows.net') !== -1 || key.indexOf('msal') !== -1) {
                try {
                  var parsed = JSON.parse(store.getItem(key));
                  if (parsed && parsed.name && isValidName(parsed.name)) {
                    sendUserName(parsed.name);
                    return true;
                  }
                } catch(e) {}
              }
            }
          }
        } catch(e) {}
        return false;
      }

      function extractFromDOM() {
        var selectors = [
          '#mectrl_currentAccount_primary',
          '.mectrl_currentAccount_primary',
          '[data-automation-id="personaName"]',
          '.ms-Persona-primaryText',
          '.o365cs-me-tile-name',
          '[data-testid="profile-card-name"]',
        ];
        for (var i = 0; i < selectors.length; i++) {
          try {
            var el = document.querySelector(selectors[i]);
            if (el) {
              var txt = (el.textContent || '').trim();
              if (isValidName(txt)) { sendUserName(txt); return true; }
              var aria = (el.getAttribute('aria-label') || '').trim();
              if (isValidName(aria)) { sendUserName(aria); return true; }
              var title = (el.getAttribute('title') || '').trim();
              if (isValidName(title)) { sendUserName(title); return true; }
            }
          } catch(e) {}
        }
        return false;
      }

      function tryExtract() {
        if (confirmedUser) return;
        if (extractFromMSAL()) return;
        extractFromDOM();
      }

      function reportSessionIssue(reason) {
        if (reportedSessionIssue) return;
        reportedSessionIssue = true;
        wvLog('error', 'Session issue confirmed', { reason: reason || 'unknown' });
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'sessionIssue',
            reason: reason || 'unknown',
            url: location.href
          }));
        } catch (e) {}
      }

      var lastUserActivitySentAt = 0;
      function reportUserActivity() {
        try {
          var now = Date.now();
          if (now - lastUserActivitySentAt < 1500) return;
          lastUserActivitySentAt = now;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'userActivity',
            ts: now
          }));
        } catch (e) {}
      }

      var sessionErrorPhrase = null;
      var sessionErrorSince = 0;
      var SESSION_ERROR_CONFIRM_MS = 2800;
      var SESSION_ERROR_POLL_MS = 700;
      var lastSessionErrorObserveCheck = 0;

      function checkForSessionErrors() {
        try {
          var phrases = [
            "this app isn't working",
            "denne appen fungerer ikke",
            "session expired",
            "økt utløpt"
          ];
          var txt = ((document.body && document.body.innerText) || '').toLowerCase();
          var matched = null;
          for (var i = 0; i < phrases.length; i++) {
            if (txt.indexOf(phrases[i]) !== -1) {
              matched = phrases[i];
              break;
            }
          }
          var now = Date.now();
          if (matched) {
            if (sessionErrorPhrase === matched) {
              if (now - sessionErrorSince >= SESSION_ERROR_CONFIRM_MS) {
                reportSessionIssue(matched);
              }
            } else {
              sessionErrorPhrase = matched;
              sessionErrorSince = now;
              wvLog('warn', 'Session error phrase detected', { phrase: matched });
            }
          } else {
            sessionErrorPhrase = null;
          }
        } catch (e) {}
      }

      function checkForSessionErrorsFromObserver() {
        var now = Date.now();
        if (now - lastSessionErrorObserveCheck < SESSION_ERROR_POLL_MS) return;
        lastSessionErrorObserveCheck = now;
        checkForSessionErrors();
      }
      
      var observer = new MutationObserver(function() {
        if (!confirmedUser) tryExtract();
        checkForSessionErrorsFromObserver();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.addEventListener('pointerdown', reportUserActivity, { passive: true });
      document.addEventListener('touchstart', reportUserActivity, { passive: true });
      document.addEventListener('keydown', reportUserActivity, { passive: true });
      document.addEventListener('scroll', reportUserActivity, { passive: true });
      document.addEventListener('click', reportUserActivity, { passive: true });
      
      setTimeout(tryExtract, 2000);
      setTimeout(tryExtract, 5000);
      setTimeout(tryExtract, 10000);
      setTimeout(tryExtract, 20000);
      setInterval(function() { if (!confirmedUser) tryExtract(); }, 8000);
      setTimeout(checkForSessionErrors, 2500);
      setInterval(checkForSessionErrors, SESSION_ERROR_POLL_MS);
      setInterval(function() {
        wvLog('debug', 'WebView heartbeat', { path: location.pathname });
      }, 120000);
      
      true;
    })();
  `;

  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const url = request.url;
    logDebug('nav', 'Navigation request', { url: redactUrl(url) });
    
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
        <Pressable style={styles.headerLeft} onPress={handleDiagnosticHeaderPress}>
          {userName && <Text style={styles.userText} numberOfLines={1}>{userName}</Text>}
        </Pressable>
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.webViewContainer, { paddingBottom: insets.bottom }]}
      >
        {Platform.OS === 'web' ? null : logoutComplete ? (
          <View style={styles.logoutCompleteContainer}>
            <Text style={styles.logoutCompleteTitle}>Du er logget ut</Text>
            <Text style={styles.logoutCompleteText}>Utloggingen er fullført. Du kan nå lukke appen.</Text>
          </View>
        ) : isRecovering ? (
          <View style={styles.recoveringContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.recoveringText}>Laster på nytt…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => resetSession('manual-restart')}>
              <Text style={styles.retryButtonText}>Start ny sesjon</Text>
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
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={(syntheticEvent: any) => {
                const status = syntheticEvent?.nativeEvent?.statusCode;
                const url = syntheticEvent?.nativeEvent?.url;
                logError('webview', 'WebView HTTP error', {
                  status,
                  url: url ? redactUrl(url) : undefined,
                });
                handleError(syntheticEvent);
                if (status === 401 || status === 403 || status === 440) {
                  performHardLogout(`http-auth-${status}`);
                }
              }}
              injectedJavaScript={injectedJavaScript}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={false}
              incognito={true}
              cacheEnabled={false}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              mixedContentMode="always"
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures={false}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onRenderProcessGone={handleRenderProcessGone}
              onMessage={(event: { nativeEvent: { data: string } }) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'webviewLog') {
                    handleWebViewLog(data.level, data.message, data.data);
                  } else if (data.type === 'userName' && data.value) {
                    const name = data.value.trim();
                    const bad = ['skip', 'hopp', 'hovedinnhold', 'main content', 'innhold', 'sign in', 'logg inn', 'loading', 'laster', 'powerapps', 'undefined', 'null'];
                    const lower = name.toLowerCase();
                    const isInvalid = bad.some(b => lower.includes(b));
                    if (!isInvalid && name.length >= 2 && name.length <= 80) {
                      logInfo('session', 'Received userName', { name });
                      setUserName(name);
                    } else {
                      logDebug('session', 'Rejected invalid userName', { name });
                    }
                  } else if (data.type === 'userActivity') {
                    lastInteractionAtRef.current = Date.now();
                  } else if (data.type === 'resumeHealth') {
                    logWarn('session', 'Resume health check', {
                      hasBad: data.hasBad,
                      url: data.url ? redactUrl(data.url) : undefined,
                    });
                    if (data.hasBad) {
                      performHardLogout('resume-health-failed');
                    }
                  } else if (data.type === 'sessionIssue') {
                    logError('session', 'Session issue from WebView', { reason: data.reason });
                    performHardLogout(`session-issue-${data.reason || 'unknown'}`);
                  }
                } catch (e) {
                  logWarn('webview', 'Message parse error', { error: String(e) });
                }
              }}
              originWhitelist={['*']}
              onNavigationStateChange={(navState: { url: string; loading?: boolean }) => {
                logDebug('nav', 'Navigation state change', {
                  url: redactUrl(navState.url),
                  loading: navState.loading,
                });
                lastInteractionAtRef.current = Date.now();
                
                // After logout completes, reload with fresh login prompt
                if (isLoggingOut) {
                  // Check if we've completed logout flow
                  if (navState.url.includes('logout') || 
                      navState.url.includes('loggedout') || 
                      navState.url.includes('login.microsoftonline.com') ||
                      navState.url.includes('login.live.com')) {
                    logInfo('session', 'Logout in progress');
                  }
                  
                  // If logout session completed or redirected to login page
                  if (navState.url.includes('logoutsession') || 
                      navState.url.includes('signout') ||
                      navState.url.includes('select_account') ||
                      navState.url.includes('/authorize') ||
                      (navState.loading === false && navState.url.includes('microsoftonline.com') && !navState.url.includes('logout'))) {
                    logInfo('session', 'Logout complete, closing app');
                    setIsLoggingOut(false);
                    setLogoutComplete(true);
                    if (Platform.OS === 'android') {
                      setTimeout(() => {
                        BackHandler.exitApp();
                      }, 300);
                    }
                  }
                }
              }}
            />
          </>
        ) : null}
      </KeyboardAvoidingView>
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
  recoveringContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
    gap: 16,
  },
  recoveringText: {
    fontSize: 16,
    color: Colors.textSecondary,
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
