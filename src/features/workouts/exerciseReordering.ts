export type ExerciseLayout = { height: number; y: number };

export function getExerciseDragTarget(
  exerciseIds: string[],
  layouts: Readonly<Record<string, ExerciseLayout>>,
  draggedId: string,
  offsetY: number,
): number | undefined {
  const source = layouts[draggedId];
  const sourceIndex = exerciseIds.indexOf(draggedId);
  if (!source || sourceIndex < 0) return undefined;

  const draggedCenter = source.y + source.height / 2 + offsetY;
  let targetIndex = sourceIndex;

  exerciseIds.forEach((id, index) => {
    const layout = layouts[id];
    if (!layout || id === draggedId) return;
    const center = layout.y + layout.height / 2;
    if (index < sourceIndex && draggedCenter < center) {
      targetIndex = Math.min(targetIndex, index);
    }
    if (index > sourceIndex && draggedCenter > center) {
      targetIndex = Math.max(targetIndex, index);
    }
  });

  return targetIndex;
}
