import { shopDatabase } from "./supabase";
import type { Tables } from "@/types/database";
export type SetupData = {
  vehicles: Tables<"vehicles">[];
  profiles: Tables<"profiles">[];
  partCount: number;
  comebackCount: number;
  rates: Tables<"tech_pay_rates">[];
  connected: boolean;
  error: string | null;
};
export async function getSetupData(): Promise<SetupData> {
  try {
    const db = shopDatabase();
    const [vehicles, profiles, parts, comebacks, rates] = await Promise.all([
      db.from("vehicles").select("*").order("stock_number"),
      db.from("profiles").select("*").order("full_name"),
      db.from("parts").select("id", { head: true, count: "exact" }),
      db
        .from("jobs")
        .select("id", { head: true, count: "exact" })
        .eq("is_comeback", true),
      db
        .from("tech_pay_rates")
        .select("*")
        .order("effective_from", { ascending: false }),
    ]);
    for (const result of [vehicles, profiles, parts, comebacks, rates])
      if (result.error)
        throw new Error(
          "The shop database could not be read. Check the connection and migrations.",
        );
    return {
      vehicles: vehicles.data ?? [],
      profiles: profiles.data ?? [],
      partCount: parts.count ?? 0,
      comebackCount: comebacks.count ?? 0,
      rates: rates.data ?? [],
      connected: true,
      error: null,
    };
  } catch (error) {
    return {
      vehicles: [],
      profiles: [],
      partCount: 0,
      comebackCount: 0,
      rates: [],
      connected: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to the shop database.",
    };
  }
}
