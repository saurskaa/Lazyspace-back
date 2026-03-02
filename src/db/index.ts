import { createClient } from '@supabase/supabase-js';

// The project URL deduced from your previous host:
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztedruwykvwchlnkxbmb.supabase.co';

// Put your publishable API key here (the 'anon' / 'public' key)
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_9Jc_34K1OAwi0zvhGH4tnQ_o9vnM6eB';

export const supabase = createClient(supabaseUrl, supabaseKey);
