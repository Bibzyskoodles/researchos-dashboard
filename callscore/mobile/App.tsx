/**
 * CallScore — the enumerator's Device 2 app (Bible Part 2.2).
 * MVP scope per Bible Part 10: standalone app, manual screenshot attach,
 * offline queuing. The CallScore Link companion app + BLE pairing is V1.
 *
 * Flow (Bible 2.3): pick respondent → record consent (hard gate) →
 * Start Interview → questionnaire + evidence → Stop → queue for sync.
 * Simple state-machine navigation — no deep links needed at this scope.
 */
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getToken, getUser } from './src/api/client';
import { startSyncListener } from './src/sync/syncService';
import LoginScreen from './src/screens/LoginScreen';
import RespondentListScreen from './src/screens/RespondentListScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import InterviewScreen from './src/screens/InterviewScreen';
import SyncQueueScreen from './src/screens/SyncQueueScreen';
import { Respondent } from './src/types';

type Screen =
  | { name: 'login' }
  | { name: 'respondents' }
  | { name: 'syncQueue' }
  | { name: 'consent'; respondent: Respondent; projectId: string }
  | { name: 'interview'; respondent: Respondent; projectId: string; consentUri: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'login' });
  const [identity, setIdentity] = useState<{ enumeratorId: string; orgId: string }>({
    enumeratorId: '', orgId: '',
  });

  useEffect(() => {
    const unsubscribe = startSyncListener();
    void (async () => {
      if (await getToken()) {
        const user = await getUser();
        setIdentity({ enumeratorId: user?.id || user?.email || 'unknown', orgId: user?.org || '' });
        setScreen({ name: 'respondents' });
      }
    })();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style={screen.name === 'login' ? 'light' : 'dark'} />
        {screen.name === 'login' && (
          <LoginScreen
            onLoggedIn={async () => {
              const user = await getUser();
              setIdentity({ enumeratorId: user?.id || user?.email || 'unknown', orgId: user?.org || '' });
              setScreen({ name: 'respondents' });
            }}
          />
        )}
        {screen.name === 'respondents' && (
          <RespondentListScreen
            onSelect={(respondent, projectId) => setScreen({ name: 'consent', respondent, projectId })}
            onOpenSyncQueue={() => setScreen({ name: 'syncQueue' })}
          />
        )}
        {screen.name === 'syncQueue' && (
          <SyncQueueScreen onBack={() => setScreen({ name: 'respondents' })} />
        )}
        {screen.name === 'consent' && (
          <ConsentScreen
            respondent={screen.respondent}
            projectId={screen.projectId}
            onBack={() => setScreen({ name: 'respondents' })}
            onConsentCaptured={(consentUri) =>
              setScreen({
                name: 'interview',
                respondent: screen.respondent,
                projectId: screen.projectId,
                consentUri,
              })
            }
          />
        )}
        {screen.name === 'interview' && (
          <InterviewScreen
            respondent={screen.respondent}
            projectId={screen.projectId}
            orgId={identity.orgId}
            enumeratorId={identity.enumeratorId}
            consentUri={screen.consentUri}
            onDone={() => setScreen({ name: 'respondents' })}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
