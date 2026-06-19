<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const createClient = () => createBrowserClient(url, anon);

export const createServerSupabase = async () => {
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookieList) => {
        cookieList.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    }
  });
};
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
>>>>>>> theirs
