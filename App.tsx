import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseCatalog } from './src/features/exercises/ExerciseCatalog';
import { WorkoutScreen } from './src/features/workouts/WorkoutScreen';
import { StatisticsScreen } from './src/features/statistics/StatisticsScreen';
import {
  APP_SECTIONS,
  DEFAULT_SECTION,
  type SectionId,
} from './src/navigation/sections';
import { requestPersistentStorage } from './src/pwa/persistentStorage';
import {
  createRepositories,
  type AppRepositories,
} from './src/repositories/createRepositories';

export default function App() {
  const [activeSection, setActiveSection] =
    useState<SectionId>(DEFAULT_SECTION);
  const [repositories, setRepositories] = useState<AppRepositories | null>(
    null,
  );
  const [dataRevision, setDataRevision] = useState(0);
  const [databaseError, setDatabaseError] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const activeLabel = APP_SECTIONS.find(
    ({ id }) => id === activeSection,
  )?.label;

  useEffect(() => {
    async function initializeDatabase() {
      try {
        setRepositories(await createRepositories());
        setStorageWarning(!(await requestPersistentStorage()));
      } catch {
        setDatabaseError(true);
      }
    }

    void initializeDatabase();
  }, []);

  const content = databaseError ? (
    <View style={styles.content}>
      <Text style={styles.title}>{activeLabel}</Text>
      <Text accessibilityRole="alert" style={styles.errorState}>
        Не удалось открыть локальное хранилище.
      </Text>
    </View>
  ) : !repositories ? (
    <View style={styles.loadingState}>
      <ActivityIndicator color="#111827" />
    </View>
  ) : activeSection === 'exercises' ? (
    <ExerciseCatalog repository={repositories.exercises} />
  ) : activeSection === 'workouts' ? (
    <WorkoutScreen
      exerciseRepository={repositories.exercises}
      key={dataRevision}
      workoutRepository={repositories.workouts}
    />
  ) : (
    <StatisticsScreen
      dataTransferRepository={repositories.dataTransfer}
      exerciseRepository={repositories.exercises}
      key={dataRevision}
      onImported={() => setDataRevision((value) => value + 1)}
      workoutRepository={repositories.workouts}
    />
  );

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <StatusBar style="dark" />
        {content}

        {storageWarning ? (
          <Text accessibilityRole="alert" style={styles.storageWarning}>
            Браузер не предоставил постоянное хранилище. Регулярно сохраняй
            резервную копию.
          </Text>
        ) : null}

        <View accessibilityRole="tablist" style={styles.tabBar}>
          {APP_SECTIONS.map(({ id, label }) => {
            const isActive = id === activeSection;

            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={id}
                onPress={() => setActiveSection(id)}
                style={[styles.tab, isActive && styles.activeTab]}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  eyebrow: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#111827',
    fontSize: 34,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyState: {
    color: '#6b7280',
    fontSize: 17,
    lineHeight: 24,
    marginTop: 16,
  },
  errorState: { color: '#b91c1c', fontSize: 17, marginTop: 16 },
  loadingState: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  storageWarning: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 8,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  activeTab: {
    backgroundColor: '#111827',
  },
  tabLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#ffffff',
  },
});
