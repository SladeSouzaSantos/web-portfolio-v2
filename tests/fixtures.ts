import { test as base, expect } from '@playwright/test';
import { watchRuntimeErrors } from './helpers/runtime-errors';
import { installSafeChatMock } from './helpers/orbe-mock';
import { installSafePlatformMock } from './helpers/platform-mock';

export { expect };
export type { Page } from '@playwright/test';

export const test = base.extend<{ runtimeCheck: void }>({
  runtimeCheck: [async ({ page, context, baseURL }, use, testInfo) => {
    if (!baseURL) throw new Error('O monitor de recursos precisa de baseURL.');
    await installSafePlatformMock(context, baseURL);
    await installSafeChatMock(context);
    const monitor = watchRuntimeErrors(page, baseURL);
    try {
      await use();
    } finally {
      monitor.stop();
      if (monitor.failures.length || monitor.externalFailures.length) {
        await testInfo.attach('runtime-and-resource-errors', {
          body: JSON.stringify({ failures: monitor.failures, externalFailures: monitor.externalFailures }, null, 2),
          contentType: 'application/json',
        });
      }
      expect(monitor.failures, 'Erros JavaScript ou falhas de recursos do site').toEqual([]);
    }
  }, { auto: true }],
});
