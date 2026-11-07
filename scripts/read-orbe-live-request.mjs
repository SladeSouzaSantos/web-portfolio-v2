#!/usr/bin/env node
/**
 * A dedicated commit touching .github/orbe-live-dev.request.json is the
 * only push-based trigger for real DEV LLM tests. This is not a deployment.
 * No external calls, tokens or prompt content are logged by this script.
 */
import { readFile, appendFile } from 'node:fs/promises';

function fail(message) {
  console.error(`ORBE_LIVE_REQUEST_BLOCKED: ${message}`);
  process.exitCode = 1;
}

async function main() {
  if (process.env.GITHUB_REF !== 'refs/heads/dev' ||
      process.env.GITHUB_EVENT_NAME !== 'push') {
    fail('Only an explicit push on DEV may use the request-file trigger.');
    return;
  }
  let request;
  try {
    request = JSON.parse(await readFile('.github/orbe-live-dev.request.json', 'utf8'));
  } catch {
    fail('Approved DEV request file is missing or malformed.');
    return;
  }
  if (!request || typeof request !== 'object' ||
      Object.keys(request).sort().join('|') !==
      ['approval', 'backendSha', 'requestId', 'schemaVersion', 'suite'].sort().join('|') ||
      request.schemaVersion !== 1 ||
      request.approval !== 'RUN_REAL_DEV_LLM_TESTS' ||
      !['smoke', 'extended'].includes(request.suite) ||
      !/^[a-f0-9]{40}$/.test(request.backendSha) ||
      typeof request.requestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{8,64}$/.test(request.requestId)) {
    fail('Request must explicitly approve a bounded DEV-only suite and pinned backend SHA.');
    return;
  }
  if (!process.env.GITHUB_ENV) {
    fail('GitHub environment file is required for this trigger.');
    return;
  }
  await appendFile(
    process.env.GITHUB_ENV,
    `ORBE_LIVE_SUITE=${request.suite}\nORBE_LIVE_EXPECTED_BACKEND_SHA=${request.backendSha}\n`,
    'utf8',
  );
  console.info(
    `ORBE_LIVE_REQUEST_APPROVED suite=${request.suite} request=${request.requestId} backend=${request.backendSha.slice(0, 12)}`,
  );
}

main().catch(() => fail('Could not validate DEV request file.'));
