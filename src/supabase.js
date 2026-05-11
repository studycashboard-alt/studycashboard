import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://astgazboqpwhcuyemshx.supabase.co";

const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGdhemJvcXB3aGN1eWVtc2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzUyMDAsImV4cCI6MjA5Mzg1MTIwMH0.9ZKI3MaZbJSWSm2QC2jOETrhGTiUETcvmZW4PCJWyk8";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
