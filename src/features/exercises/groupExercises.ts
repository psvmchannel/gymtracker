import {
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '../../domain/exercise';

export type ExerciseGroup = {
  muscleGroup: MuscleGroup;
  exercises: Exercise[];
};

export function groupExercises(exercises: Exercise[]): ExerciseGroup[] {
  const exercisesByGroup = new Map<MuscleGroup, Exercise[]>();

  for (const exercise of exercises) {
    const group = exercisesByGroup.get(exercise.muscleGroup);
    if (group) {
      group.push(exercise);
    } else {
      exercisesByGroup.set(exercise.muscleGroup, [exercise]);
    }
  }

  return MUSCLE_GROUPS.flatMap((muscleGroup) => {
    const group = exercisesByGroup.get(muscleGroup);
    return group ? [{ muscleGroup, exercises: group }] : [];
  });
}
