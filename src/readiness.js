const CHECKS = [
  {
    id: "observed_behavior",
    label: "Observed behavior",
    required: true,
    weight: 20,
    patterns: [/\b(actual|current|observed) (behavior|result)\b/i, /\b(error|exception|traceback|fails?|failure|crash(?:es|ed)?)\b/i],
    suggestion: "Describe what actually happened, including the exact error.",
  },
  {
    id: "expected_behavior",
    label: "Expected behavior",
    required: true,
    weight: 15,
    patterns: [/\bexpected (behavior|result|output)\b/i, /\bshould (?:have |be |return|produce|show|work)/i],
    suggestion: "State the expected behavior without asking the model to infer it.",
  },
  {
    id: "reproduction_steps",
    label: "Reproduction steps",
    required: true,
    weight: 20,
    patterns: [/\b(steps? to reproduce|reproduction|repro steps?)\b/i, /(?:^|\n)\s*(?:1[.)]|- )\s+\S/m],
    suggestion: "Add minimal steps starting from a known state.",
  },
  {
    id: "environment",
    label: "Environment",
    required: true,
    weight: 10,
    patterns: [/\b(environment|operating system|os version|runtime|browser|node\.js|python|java)\b/i],
    suggestion: "Include the affected OS, runtime and application versions.",
  },
  {
    id: "reproducibility",
    label: "Frequency",
    required: true,
    weight: 10,
    patterns: [/\b(always|intermittent(?:ly)?|sometimes|every time|\d+\s*(?:out of|\/)\s*\d+)\b/i],
    suggestion: "Say whether the failure is always or intermittently reproducible.",
  },
  {
    id: "localization",
    label: "Localization cue",
    required: false,
    weight: 15,
    patterns: [/[A-Za-z0-9_.-]+\.(?:js|ts|tsx|jsx|py|go|rs|java|rb|php|cs|cpp|c|h)(?::\d+)?/, /\b(function|method|class|module|component|endpoint|package)\s+[`'"A-Za-z_]/i],
    suggestion: "Point to a suspected file, function, component or endpoint if known.",
  },
  {
    id: "repair_direction",
    label: "Repair direction",
    required: false,
    weight: 10,
    patterns: [/\b(possible fix|suggested fix|root cause|caused by|regression|likely because)\b/i],
    suggestion: "If known, add a suspected cause or repair direction and label it as a hypothesis.",
  },
];

export function assessIssue(text) {
  if (!text) return null;
  const checks = CHECKS.map((check) => {
    const present = check.patterns.some((pattern) => pattern.test(text));
    return {
      id: check.id,
      label: check.label,
      present,
      required: check.required,
      weight: check.weight,
      suggestion: present ? null : check.suggestion,
    };
  });
  const score = checks.reduce((total, check) => total + (check.present ? check.weight : 0), 0);
  const required = checks.filter((check) => check.required);
  const optional = checks.filter((check) => !check.required);
  const requiredPresent = required.filter((check) => check.present).length;
  const optionalPresent = optional.filter((check) => check.present).length;
  const checklist = {
    requiredPresent,
    requiredTotal: required.length,
    missingRequired: required.filter((check) => !check.present).map((check) => check.id),
    optionalPresent,
    optionalTotal: optional.length,
  };
  const band = requiredPresent === required.length
    ? "ready"
    : requiredPresent >= Math.ceil(required.length / 2)
      ? "needs_context"
      : "insufficient";

  return {
    score,
    band,
    checklist,
    checks,
    note: "Checklist status is primary. The numeric score is an uncalibrated compatibility field, not a prediction that an agent will fix the bug.",
  };
}
