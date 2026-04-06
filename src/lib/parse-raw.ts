export type ParsedOption = { label: string; correct: boolean };
export type ParsedQuestion = { title: string; options: ParsedOption[] };

/**
 * Contract: Q: starts a question; following lines starting with - are options;
 * trailing * marks correct. Blank lines ignored. No answers before first Q:.
 */
export function parseRawQuestionnaireText(raw: string): ParsedQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === "") continue;

    if (/^Q:\s*/i.test(trimmed)) {
      if (current && current.options.length === 0) {
        throw new Error(`Question has no answers: "${current.title}"`);
      }
      if (current) questions.push(current);
      const title = trimmed.replace(/^Q:\s*/i, "").trim();
      if (!title) throw new Error("Empty question title after Q:");
      current = { title, options: [] };
      continue;
    }

    if (/^-\s*/.test(trimmed)) {
      if (!current) throw new Error("Answer line appears before the first Q:");
      let rest = trimmed.replace(/^-\s*/, "");
      let correct = false;
      if (rest.endsWith("*")) {
        correct = true;
        rest = rest.slice(0, -1).trimEnd();
      }
      const label = rest.trim();
      if (!label) throw new Error("Empty answer option");
      current.options.push({ label, correct });
      continue;
    }

    throw new Error(`Unexpected line: ${trimmed.slice(0, 80)}`);
  }

  if (current && current.options.length === 0) {
    throw new Error(`Question has no answers: "${current.title}"`);
  }
  if (current) questions.push(current);

  if (questions.length === 0) throw new Error("No questions parsed");

  return questions;
}

export function validateParsedAgainstSettings(
  parsed: ParsedQuestion[],
  allowMultipleCorrect: boolean,
): void {
  for (const q of parsed) {
    const correctCount = q.options.filter((o) => o.correct).length;
    if (correctCount === 0) {
      throw new Error(`Question "${q.title}" must have at least one correct answer (*)`);
    }
    if (!allowMultipleCorrect && correctCount > 1) {
      throw new Error(
        `Question "${q.title}" has multiple correct answers; enable "allow multiple correct" on the questionnaire or mark only one with *`,
      );
    }
  }
}
