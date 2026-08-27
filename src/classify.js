export function classifyRuns(runs, expectation = "fail") {
  if (runs.length === 0) {
    return { verdict: "invalid", verified: false, summary: "No runs were recorded." };
  }

  if (runs.some((run) => run.timedOut)) {
    return { verdict: "timed_out", verified: false, summary: "At least one run timed out." };
  }

  if (runs.some((run) => run.spawnError)) {
    return { verdict: "command_error", verified: false, summary: "The reproduction command could not be started." };
  }

  if (runs.some((run) => run.isolationCleanupError)) {
    return {
      verdict: "isolation_error",
      verified: false,
      summary: "An isolated attempt could not be cleaned up safely.",
    };
  }

  if (runs.some((run) => run.stateContaminated ?? run.stateChanged)) {
    return {
      verdict: "contaminated",
      verified: false,
      summary: "The command changed tracked repository state; repeated runs are not independent.",
    };
  }

  const failed = runs.filter((run) => run.exitCode !== 0);
  const passed = runs.length - failed.length;

  if (expectation === "pass") {
    if (failed.length === 0) {
      if (runs.length < 2) {
        return { verdict: "observed_pass", verified: false, summary: "The command passed once; repeat it to verify stability." };
      }
      return { verdict: "verified_pass", verified: true, summary: `All ${runs.length} runs passed.` };
    }
    if (passed > 0) {
      return { verdict: "flaky", verified: false, summary: `${passed}/${runs.length} runs passed.` };
    }
    return { verdict: "unexpected_failure", verified: false, summary: "Every run failed." };
  }

  if (failed.length === 0) {
    return { verdict: "not_reproduced", verified: false, summary: "The expected failure did not occur." };
  }
  if (runs.length < 2) {
    return { verdict: "observed_failure", verified: false, summary: "The failure occurred once; repeat it to verify stability." };
  }
  if (passed > 0) {
    return { verdict: "flaky", verified: false, summary: `${failed.length}/${runs.length} runs failed.` };
  }

  const fingerprints = new Set(failed.map((run) => run.fingerprint));
  if (fingerprints.size === 1) {
    return {
      verdict: "stable_failure",
      verified: true,
      summary: `The same failure occurred in all ${runs.length} runs.`,
    };
  }
  return {
    verdict: "divergent_failure",
    verified: false,
    summary: `All runs failed, but produced ${fingerprints.size} distinct failure signatures.`,
  };
}
