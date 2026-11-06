import type { Tables } from "@/types/database";
// Shared display types; the parser and FTPS client stay server-only.
export type InventoryRow = {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  color: string;
  advertised_mileage: number | null;
  photos: string[];
};
export type ImportRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  filename: string | null;
  file_date: string | null;
  file_hash: string | null;
  row_count: number;
  error: string | null;
  trigger: string;
  fresh: boolean;
  missing_safe: boolean;
};
export type ImportItem = {
  id: string;
  run_id: string;
  row_data: InventoryRow;
  fingerprint: string;
  kind: "new" | "change" | "matched" | "conflict";
  decision: "pending" | "approved" | "dismissed";
  vehicle_id: string | null;
  expected_vehicle: Tables<"vehicles"> | null;
  note: string | null;
};
export type InventoryData = {
  runs: ImportRun[];
  latest: ImportRun | null;
  items: ImportItem[];
  vehicles: Tables<"vehicles">[];
  profiles: Tables<"profiles">[];
  missing: Tables<"vehicles">[];
};
