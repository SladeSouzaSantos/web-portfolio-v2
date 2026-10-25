import { PlatformApiError } from '../../services/platformHttp';

export function formatMeetingInstant(value: string, timeZone: string): string {
  try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(value)); }
  catch { return value; }
}

/** Convert a calendar day in the returned zone, independently of the browser's local zone. */
export function meetingAvailabilityWindow(date: string, timeZone: string): { from: string; to: string } {
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) throw new PlatformApiError('validation', 'Escolha uma data válida.');
  const expected = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(expected) || new Date(expected).toISOString().slice(0, 10) !== date) {
    throw new PlatformApiError('validation', 'Escolha uma data válida.');
  }
  let instant = expected;
  try {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let index = 0; index < 2; index++) {
      const parts = Object.fromEntries(format.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
      const displayed = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      instant += expected - displayed;
    }
  } catch { throw new PlatformApiError('protocol', 'O fuso horário da agenda não é válido.'); }
  return { from: new Date(instant).toISOString(), to: new Date(instant + 7 * 24 * 60 * 60 * 1000).toISOString() };
}
