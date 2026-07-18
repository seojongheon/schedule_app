export const fixedNow = new Date('2026-07-18T00:00:00.000Z');

export function fixedClock() {
  return {
    now: () => new Date(fixedNow),
  };
}

export function requestHeaders(values = {}) {
  return new Headers({
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    ...values,
  });
}

export function memoryAuditSink() {
  const events = [];

  return {
    events,
    append: async (event) => {
      events.push(event);
    },
  };
}
