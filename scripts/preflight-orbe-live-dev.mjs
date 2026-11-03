#!/usr/bin/env node
/**
 * Read-only release gate for opt-in Live DEV browser tests.
 * A successful code/Neo4j CI is not a deployed release.
 * Never prints GitHub tokens, conversation credentials or response bodies.
 */
const expected = process.env.ORBE_LIVE_EXPECTED_BACKEND_SHA ?? '';
const backend = 'SladeSouzaSantos/phasscode-platform';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

function fail(message) {
  console.error(`ORBE_LIVE_PREFLIGHT_BLOCKED: ${message}`);
  process.exitCode = 1;
}

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${backend}/${path}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  if (!response.ok()) throw new Error(`GitHub metadata HTTP ${response.status}`);
  return response.json();
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(expected)) {
    fail('A full, pinned DEV SHA is mandatory.');
    return;
  }
  const ref = await github('git/ref/heads/dev');
  if (ref?.object?.sha !== expected) {
    fail('Backend DEV HEAD moved after the requested deployment; select a newly verified release.');
    return;
  }

  const runs = await github(
    'actions/workflows/deploy.yml/runs?branch=dev&event=workflow_dispatch&per_page=20',
  );
  const recent = (runs.workflow_runs ?? []).filter(
    (run) => run.head_branch === 'dev' && run.event === 'workflow_dispatch',
  );
  const latest = recent[0];
  if (!latest || latest.head_sha !== expected || latest.conclusion !== 'success') {
    fail('Latest manual DEV workflow must be successful for exactly the pinned SHA.');
    return;
  }

  const jobs = await github(`actions/runs/${latest.id}/jobs?per_page=100`);
  const success = (name) =>
    (jobs.jobs ?? []).some((job) => job.name === name && job.conclusion === 'success');
  if (!success('deploy') || !success('verify')) {
    fail('Backend manual workflow must have BOTH deploy and verify successful.');
    return;
  }

  for (const [url, label] of [
    ['https://devapi.phasscode.com/health', 'DEV API'],
    ['https://devgbc.phasscode.com', 'DEV portfolio'],
  ]) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!response.ok()) {
      fail(`${label} failed HTTP health/readability check ${response.status}`);
      return;
    }
  }

  console.info(`LIVE_DEV_PREFLIGHT_OK backend_sha=${expected.slice(0, 12)} verified_run=${latest.id} target=dev-only`);
}

main().catch(() => {
  // Suppress raw exception details (which can contain URLs or upstream headers).
  fail('Unable to verify pinned DEV release and healthy DEV endpoints.');
});
