/**
 * Multi-answer partial score: max(0, (|U∩C| - |U\\C|) / |C|)
 * Single correct option: 1 if sets equal else 0.
 */
export function questionScore(
  correctOptionIds: Set<string>,
  selectedOptionIds: Set<string>,
): number {
  if (correctOptionIds.size === 0) return 0;
  if (correctOptionIds.size === 1 && selectedOptionIds.size <= 1) {
    const [only] = [...correctOptionIds];
    return selectedOptionIds.has(only) ? 1 : 0;
  }

  let intersection = 0;
  for (const id of selectedOptionIds) {
    if (correctOptionIds.has(id)) intersection++;
  }
  let onlySelected = 0;
  for (const id of selectedOptionIds) {
    if (!correctOptionIds.has(id)) onlySelected++;
  }

  const raw = (intersection - onlySelected) / correctOptionIds.size;
  return Math.max(0, raw);
}

export function totalScorePercent(
  perQuestionScores: number[],
): number {
  if (perQuestionScores.length === 0) return 0;
  const sum = perQuestionScores.reduce((a, b) => a + b, 0);
  return Math.round((sum / perQuestionScores.length) * 10000) / 100;
}
