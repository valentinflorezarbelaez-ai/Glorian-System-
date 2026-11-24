// Consume Node's coverage event directly so test output cannot be mistaken for coverage.
export default async function* coverageReporter(events) {
  let totals;
  for await (const { type, data } of events) {
    if (type === "test:fail") {
      yield `[COVERAGE] Failed test: ${data.name} — ${data.details.error.message}\n`;
    }
    if (type === "test:coverage" && data.summary.files.length > 0) totals = data.summary.totals;
  }

  const percentages = [totals?.coveredLinePercent, totals?.coveredBranchPercent, totals?.coveredFunctionPercent];
  if (!percentages.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) {
    throw new Error("Stage 4.5 requires a complete V8 coverage summary with measured files.");
  }
  const [lines, branches, functions] = percentages.map((value) => value.toFixed(2));
  yield `[COVERAGE] Lines: ${lines}% | Branches: ${branches}% | Functions: ${functions}%\n`;
}
