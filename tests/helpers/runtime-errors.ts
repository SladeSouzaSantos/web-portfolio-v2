import type { ConsoleMessage, Page, Request, Response } from '@playwright/test';

/** Watch before navigation so startup errors and initial bundle failures are included. */
export function watchRuntimeErrors(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const failures: string[] = [];
  const externalFailures: string[] = [];
  const isLocal = (url: string) => {
    try { return new URL(url).origin === origin; } catch { return false; }
  };
  const onError = (error: Error) => failures.push(`JavaScript: ${error.stack ?? error.message}`);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    const detail = `console.error: ${message.text()}${url ? ` (${url})` : ''}`;
    (url && !isLocal(url) ? externalFailures : failures).push(detail);
  };
  const onFailed = (request: Request) => {
    // A request cancelled by navigation is not a failed deployment resource.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    const detail = `${request.resourceType()}: ${request.url()} — ${request.failure()?.errorText ?? 'request failed'}`;
    (isLocal(request.url()) ? failures : externalFailures).push(detail);
  };
  const onResponse = (response: Response) => {
    const local = isLocal(response.url());
    if (response.status() >= 400) {
      (local ? failures : externalFailures).push(`HTTP ${response.status()}: ${response.url()}`);
      return;
    }
    if (!local || response.status() === 304 || response.status() >= 300) return;
    const resource = response.request().resourceType();
    const mime = response.headers()['content-type']?.toLowerCase() ?? '';
    const invalid = (resource === 'script' && !/\b(?:java|ecma)script\b/.test(mime))
      || (resource === 'stylesheet' && !mime.startsWith('text/css'))
      || (resource === 'image' && !mime.startsWith('image/'));
    if (invalid) failures.push(`${resource}: ${response.url()} — Content-Type inesperado: ${mime || '(ausente)'}`);
  };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);
  return {
    failures,
    externalFailures,
    stop() {
      page.off('pageerror', onError);
      page.off('console', onConsole);
      page.off('requestfailed', onFailed);
      page.off('response', onResponse);
    },
  };
}
