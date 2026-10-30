#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mvn -q -DincludeScope=test dependency:build-classpath -Dmdep.outputFile=target/regression-classpath.txt
CLASSPATH="target/classes:$(cat target/regression-classpath.txt)"
mkdir -p target/legacy-tests
javac -encoding UTF-8 -cp "$CLASSPATH" -d target/legacy-tests legacy-tests/src/*.java

for test_class in \
  Main \
  StressTest \
  MetricsTest \
  AccessTrackerTest \
  ResourceAccessServiceTest \
  OrdinaryBSTTest \
  AVLTreeTest \
  BenchmarkValidationTest \
  ZipfWorkloadTest \
  BenchmarkReportTest
 do
  printf '\n== %s ==\n' "$test_class"
  java -cp "target/legacy-tests:$CLASSPATH" "$test_class"
done

printf '\nAll original Java regression harnesses completed successfully.\n'
