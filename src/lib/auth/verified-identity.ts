type ClaimsClient = {
  auth: {
    getClaims(): Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }>;
  };
};

export type VerifiedIdentity = {
  id: string;
  email: string;
};

export async function getVerifiedIdentity(supabase: ClaimsClient): Promise<VerifiedIdentity | null> {
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims.sub;

  if (error || typeof subject !== 'string' || subject.length === 0) {
    return null;
  }

  return {
    id: subject,
    email: typeof data?.claims.email === 'string' ? data.claims.email : '',
  };
}
