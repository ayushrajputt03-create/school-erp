import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { schoolCode, identifier, password } = await req.json();
  const supabase = await createServerSupabase();
  const { data: school } = await supabase.from('schools').select('id').eq('school_code', schoolCode).single();
  if (!school) return NextResponse.json({ error: 'school not found' }, { status: 401 });
  const email = identifier.includes('@') ? identifier : `${identifier}@local.school`;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('school_code', schoolCode, { httpOnly: true, sameSite: 'lax', secure: true });
  return response;
}
