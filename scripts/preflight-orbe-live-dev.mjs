#!/usr/bin/env node
/**
 * Read-only release gate for opt-in Live DEV browser tests.
 * A successful code/Neo4j CI is not a deployed release.
 * Never prints GitHub tokens, conversation credentials or response bodies.
 */
const expected = process.env.ORBE_LIVE_EXPECTED_BACKEND_SHA ?? '';
const backend = 'SladeSouzaSantos/phasscode-platform';
let currentStage = 'init';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

function fail(message) {
  console.error(`ORBE_LIVE_PREFLIGHT_BLOCKED: ${message}`);
  process.exitCode = 1;
}

async function curlText(url, stage) {
  try {
    const { stdout } = await exec('curl', [
      '--fail',
      '--silent',
      '--show-error',
      '--location',
      '--max-time', '15',
      '--header', 'Accept: application/vnd.github+json',
      url,
    ], { maxBuffer: 2_000_000 });
    return stdout;
  } catch {
    throw new Error(`${stage}: HTTP/transport unavailable`);
  }
}

async function github(path, stage) {
  // Public backend metadata only. curl uses the runner's supported proxy
  // settings; do not send the frontend repository's scoped GITHUB_TOKEN.
  const url = `https://api.github.com/repos/${backend}/${path}`;
  const raw = await curlText(url, stage);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${stage}: invalid public metadata JSON`);
  }
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(expected)) {
    fail('A full, pinned DEV SHA is mandatory.');
    return;
  }
  currentStage = 'backend-ref';
  const ref = await github('git/ref/heads/dev', 'backend-ref');
  if (ref?.object?.sha !== expected) {
    fail('Backend DEV HEAD moved after the requested deployment; select a newly verified release.');
    return;
  }

  currentStage = 'backend-workflow';
  const runs = await github(
    'actions/workflows/deploy.yml/runs?branch=dev&event=workflow_dispatch&per_page=20',
    'backend-workflow',
  );
  const recent = (runs.workflow_runs ?? []).filter(
    (run) => run.head_branch === 'dev' && run.event === 'workflow_dispatch',
  );
  const latest = recent[0];
  if (!latest || latest.head_sha !== expected || latest.conclusion !== 'success') {
    fail('Latest manual DEV workflow must be successful for exactly the pinned SHA.');
    return;
  }

  currentStage = 'backend-jobs';
  const jobs = await github(`actions/runs/${latest.id}/jobs?per_page=100`, 'backend-jobs');
  const success = (name) =>
    (jobs.jobs ?? []).some((job) => job.name === name && job.conclusion === 'success');
  if (!success('deploy') || !success('verify')) {
    fail('Backend manual workflow must have BOTH deploy and verify successful.');
    return;
  }

  currentStage = 'dev-health';
  for (const [url, label] of [
    ['https://devapi.phasscode.com/health', 'DEV API'],
    ['https://devgbc.phasscode.com', 'DEV portfolio'],
  ]) {
    try {
      await curlText(url, label);
    } catch {
      fail(`${label} did not pass public health/access check.`);
      return;
    }
  }

  console.info(`LIVE_DEV_PREFLIGHT_OK backend_sha=${expected.slice(0, 12)} verified_run=${latest.id} target=dev-only`);
}

main().catch((error) => {
  // Only static stage and known transport/schema markers, never URLs/tokens.
  const message = error instanceof Error &&
    /^(backend-ref|backend-workflow|backend-jobs): (HTTP\/transport unavailable|invalid public metadata JSON)$/.test(error.message)
      ? error.message
      : `Public release verification failed at ${currentStage}`;
  fail(message);
});
