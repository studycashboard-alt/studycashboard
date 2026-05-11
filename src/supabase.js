import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://astgazboqpwhcuyemshx.supabase.co";

const supabaseAnonKey = "PASTE_YOUR_FULL_ANON_PUBLIC_KEY_HERE";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
