import { StatusBar } from 'expo-status-bar';
import { openDatabaseAsync } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExerciseCatalog } from './src/features/exercises/ExerciseCatalog';
import { WorkoutScreen } from './src/features/workouts/WorkoutScreen';
import {
  APP_SECTIONS,
  DEFAULT_SECTION,
  type SectionId,
} from './src/navigation/sections';
import type { ExerciseRepository } from './src/repositories/exerciseRepository';
import {
  migrateDatabase,
  SQLiteExerciseRepository,
} from './src/repositories/sqliteExerciseRepository';
import { SQLiteWorkoutRepository } from './src/repositories/sqliteWorkoutRepository';
import type { WorkoutRepository } from './src/repositories/workoutRepository';

export default function App() {
  const [activeSection, setActiveSection] =
    useState<SectionId>(DEFAULT_SECTION);
  const [exerciseRepository, setExerciseRepository] =
    useState<ExerciseRepository | null>(null);
  const [workoutRepository, setWorkoutRepository] =
    useState<WorkoutRepository | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const activeLabel = APP_SECTIONS.find(
    ({ id }) => id === activeSection,
  )?.label;

  useEffect(() => {
    async function initializeDatabase() {
      try {
        const db = await openDatabaseAsync('gym-tracker.db');
        await migrateDatabase(db);
        setExerciseRepository(new SQLiteExerciseRepository(db));
        setWorkoutRepository(new SQLiteWorkoutRepository(db));
      } catch {
        setDatabaseError(true);
      }
    }

    void initializeDatabase();
  }, []);

  const repositoriesAreReady = exerciseRepository && workoutRepository;
  const content = databaseError ? (
    <View style={styles.content}>
      <Text style={styles.title}>{activeLabel}</Text>
      <Text accessibilityRole="alert" style={styles.errorState}>
        Не удалось открыть локальное хранилище.
      </Text>
    </View>
  ) : !repositoriesAreReady ? (
    <View style={styles.loadingState}>
      <ActivityIndicator color="#111827" />
    </View>
  ) : activeSection === 'exercises' ? (
    <ExerciseCatalog repository={exerciseRepository} />
  ) : activeSection === 'workouts' ? (
    <WorkoutScreen
      exerciseRepository={exerciseRepository}
      workoutRepository={workoutRepository}
    />
  ) : (
    <View style={styles.content}>
      <Text style={styles.eyebrow}>GYMTRACKER</Text>
      <Text style={styles.title}>{activeLabel}</Text>
      <Text style={styles.emptyState}>
        Раздел готов к следующим этапам разработки.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {content}

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
