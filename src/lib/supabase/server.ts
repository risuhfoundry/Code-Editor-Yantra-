export async function createClient(): Promise<any> {
  throw new Error('Supabase server access is unavailable in this local editor preview.');
}

export async function createAnonClient(): Promise<any> {
  throw new Error('Supabase anon access is unavailable in this local editor preview.');
}
