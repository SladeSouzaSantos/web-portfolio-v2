// Use the base fixture here: these isolated pages intentionally produce errors.
import { expect, test } from '@playwright/test';
import { watchRuntimeErrors } from './helpers/runtime-errors';

test('monitor detects JavaScript errors, failed requests and HTML returned as a bundle', async ({ page, baseURL }) => {
  const monitor = watchRuntimeErrors(page, baseURL!);
  try {
    await page.route('**/runtime-probe', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><script>console.error("probe-console");setTimeout(() => { throw new Error("probe-runtime") }, 0)</script><script src="/probe-wrong-mime.js"></script><img src="/probe-missing.png"><link rel="stylesheet" href="/probe-abort.css">',
    }));
    await page.route('**/probe-wrong-mime.js', route => route.fulfill({ contentType: 'text/html', body: '<html>SPA fallback</html>' }));
    await page.route('**/probe-missing.png', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.route('**/probe-abort.css', route => route.abort('failed'));
    await page.goto('/runtime-probe');
    await expect.poll(() => monitor.failures.join('\n')).toContain('probe-runtime');
    expect(monitor.failures.join('\n')).toContain('probe-console');
    expect(monitor.failures.join('\n')).toContain('Content-Type inesperado: text/html');
    expect(monitor.failures.join('\n')).toContain('HTTP 404:');
    expect(monitor.failures.join('\n')).toContain('probe-abort.css');
  } finally {
    monitor.stop();
  }
});

test('monitor reports external resource failures separately without hiding site errors', async ({ page, baseURL }) => {
  const monitor = watchRuntimeErrors(page, baseURL!);
  try {
    await page.route('**/runtime-external-probe', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><img src="https://external.invalid/probe.png">',
    }));
    await page.route('https://external.invalid/**', route => route.fulfill({ status: 503, body: 'external service unavailable' }));
    await page.goto('/runtime-external-probe');
    await expect.poll(() => monitor.externalFailures.join('\n')).toContain('HTTP 503: https://external.invalid/probe.png');
    expect(monitor.failures).toEqual([]);
  } finally {
    monitor.stop();
  }
});
