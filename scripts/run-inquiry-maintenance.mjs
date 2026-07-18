import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function parseInquiryMaintenanceMode(argv) {
  if (argv[0] !== 'aging') throw new Error('A valid inquiry maintenance mode is required.');
  return 'aging';
}

export async function runAgingNotificationMaintenance(dependencies, now = new Date(), ageHours = 24) {
  if (!Number.isFinite(ageHours) || ageHours <= 0) throw new Error('Inquiry aging hours must be positive.');
  const cutoff = new Date(now.getTime() - ageHours * 60 * 60 * 1000);
  return { queued: await dependencies.enqueue(cutoff) };
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function runLive() {
  const maintenanceSecret = requireEnvironment('INQUIRY_MAINTENANCE_SECRET');
  if (maintenanceSecret.length < 32) throw new Error('INQUIRY_MAINTENANCE_SECRET must be at least 32 characters.');
  const url = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? requireEnvironment('SUPABASE_SECRET_KEY');
  const ageHours = Number(process.env.INQUIRY_AGING_HOURS ?? '24');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const requestId = randomUUID();
  return runAgingNotificationMaintenance({
    async enqueue(cutoff) {
      const { data, error } = await client.rpc('enqueue_aging_inquiry_notifications', {
        p_cutoff: cutoff.toISOString(),
        p_request_id: requestId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  }, new Date(), ageHours);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  try {
    const mode = parseInquiryMaintenanceMode(process.argv.slice(2));
    const result = await runLive();
    process.stdout.write(`${JSON.stringify({ mode, ...result })}\n`);
  } catch (error) {
    process.stderr.write(`Inquiry maintenance failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}
