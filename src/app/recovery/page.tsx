import { RecoveryForm } from '@/components/auth/AuthForms';
export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <RecoveryForm mode={mode === 'change' ? 'change' : 'request'} />;
}
