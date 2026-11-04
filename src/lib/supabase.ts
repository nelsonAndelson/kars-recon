import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";

const environmentSchema = z.object({
  url: z
    .url()
    .refine(
      (url) =>
        url.startsWith("https://") ||
        url.startsWith("http://127.0.0.1") ||
        url.startsWith("http://localhost"),
    ),
  key: z.string().min(20),
});
export function shopDatabase() {
  const environment = environmentSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!environment.success)
    throw new Error("Add the Supabase URL and publishable key to .env.local.");
  // Explicitly shared access: no user session, no service-role key, no hidden role switch.
  return createClient<Database>(environment.data.url, environment.data.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
