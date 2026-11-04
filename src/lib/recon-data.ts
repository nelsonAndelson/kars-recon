import { shopDatabase } from "./supabase";
import type { Tables } from "@/types/database";
export type BoardData = {
  vehicles: Tables<"vehicles">[];
  profiles: Tables<"profiles">[];
  jobs: Tables<"jobs">[];
  history: Tables<"stage_history">[];
  parts: Pick<Tables<"parts">, "vehicle_id" | "status">[];
  settings: Tables<"settings">;
  now: string;
};
// Supabase returns at most 1,000 rows per request. Do not silently lose history
// (and show incorrect stage ages) as the shop's inventory grows.
async function pages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const data: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await fetchPage(from, from + 999);
    if (result.error) return { data: null, error: result.error };
    data.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return { data, error: null };
  }
}
export async function getBoardData(): Promise<BoardData> {
  const db = shopDatabase();
  const [vehicles, profiles, jobs, history, parts, settings] =
    await Promise.all([
      pages((from, to) =>
        db
          .from("vehicles")
          .select("*")
          .order("purchase_date")
          .order("id")
          .range(from, to),
      ),
      db.from("profiles").select("*").eq("active", true).order("full_name"),
      pages((from, to) =>
        db
          .from("jobs")
          .select("*")
          .neq("status", "cancelled")
          .order("id")
          .range(from, to),
      ),
      pages((from, to) =>
        db
          .from("stage_history")
          .select("*")
          .order("changed_at", { ascending: false })
          .order("vehicle_id")
          .range(from, to),
      ),
      pages((from, to) =>
        db
          .from("parts")
          .select("vehicle_id,status")
          .eq("status", "ordered")
          .order("id")
          .range(from, to),
      ),
      db.from("settings").select("*").single(),
    ]);
  for (const result of [vehicles, profiles, jobs, history, parts, settings])
    if (result.error)
      throw new Error(
        "Could not load the recon board. Check the database connection.",
      );
  if (!settings.data) throw new Error("Shop settings are missing.");
  return {
    vehicles: vehicles.data ?? [],
    profiles: profiles.data ?? [],
    jobs: jobs.data ?? [],
    history: history.data ?? [],
    parts: parts.data ?? [],
    settings: settings.data,
    now: new Date().toISOString(),
  };
}
export async function getVehicleData(id: string) {
  const db = shopDatabase();
  const [car, profiles, jobs, parts, history, activity, checkin, settings] =
    await Promise.all([
      db.from("vehicles").select("*").eq("id", id).maybeSingle(),
      db.from("profiles").select("*").order("full_name"),
      db.from("jobs").select("*").eq("vehicle_id", id).order("title"),
      db.from("parts").select("*").eq("vehicle_id", id).order("name"),
      pages((from, to) =>
        db
          .from("stage_history")
          .select("*")
          .eq("vehicle_id", id)
          .order("changed_at", { ascending: false })
          .range(from, to),
      ),
      pages((from, to) =>
        db
          .from("activity_log")
          .select("*")
          .eq("vehicle_id", id)
          .order("when", { ascending: false })
          .range(from, to),
      ),
      db.from("checkins").select("*").eq("vehicle_id", id).maybeSingle(),
      db.from("settings").select("*").single(),
    ]);
  for (const result of [
    car,
    profiles,
    jobs,
    parts,
    history,
    activity,
    checkin,
    settings,
  ])
    if (result.error)
      throw new Error("Could not load this vehicle. Please try again.");
  const images = checkin.data?.photos.length
    ? await db.storage
        .from("recon-photos")
        .createSignedUrls(checkin.data.photos, 3600)
    : null;
  return {
    car: car.data,
    profiles: profiles.data ?? [],
    jobs: jobs.data ?? [],
    parts: parts.data ?? [],
    history: history.data ?? [],
    activity: activity.data ?? [],
    checkin: checkin.data,
    photos: images?.data ?? [],
    settings: settings.data,
    now: new Date().toISOString(),
  };
}
export type VehicleData = Awaited<ReturnType<typeof getVehicleData>>;
