import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";

export type FeedVehicle = {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  color: string;
  advertised_mileage: number | null;
  photos: string[];
};
export const identityFields = [
  "year",
  "make",
  "model",
  "trim",
  "color",
] as const;
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function fileDate(name: string): string | null {
  const match = /^DealerCenter_(\d{4})(\d{2})(\d{2})_28126551\.csv$/.exec(name);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
    ? date
    : null;
}
export function parseInventory(csv: string): FeedVehicle[] {
  if (Buffer.byteLength(csv) > 2_000_000)
    throw new Error("Feed exceeds the 2 MB limit.");
  let rows: Record<string, string>[];
  try {
    rows = parse(csv, {
      bom: true,
      columns: (headers: string[]) => {
        if (
          new Set(headers).size !== headers.length ||
          [
            "AccountID",
            "VIN",
            "Year",
            "Make",
            "Model",
            "Odometer",
            "PhotoURLs",
          ].some((h) => !headers.includes(h))
        )
          throw new Error("headers");
        return headers;
      },
      skip_empty_lines: true,
      max_record_size: 200_000,
    });
  } catch {
    throw new Error(
      "CSV is incomplete or has unexpected columns. No inventory was changed.",
    );
  }
  if (!rows.length || rows.length > 5000)
    throw new Error("Feed is empty or exceeds 5,000 vehicles.");
  return rows.map((r, index) => {
    const vin = (r.VIN ?? "").trim().toUpperCase(),
      year = Number(r.Year);
    const miles = (r.Odometer ?? "").trim();
    const text = (key: string, max: number) => {
      const value = (r[key] ?? "").trim();
      if (value.length > max)
        throw new Error(`Row ${index + 2}: ${key} is too long.`);
      return value;
    };
    if (
      r.AccountID?.trim() !== "28126551" ||
      !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ||
      !/^\d{4}$/.test(r.Year) ||
      year < 1900 ||
      year > 2100 ||
      !r.Make?.trim() ||
      !r.Model?.trim() ||
      (miles && (!/^\d+$/.test(miles) || Number(miles) > 2147483647))
    )
      throw new Error(
        `Row ${index + 2}: invalid account, VIN, vehicle details or mileage. No inventory was changed.`,
      );
    const photos = (r.PhotoURLs ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (
      photos.length > 100 ||
      photos.some((p) => {
        try {
          const u = new URL(p);
          return (
            u.protocol !== "https:" ||
            u.hostname !== "imagesdl.dealercenter.net" ||
            !!u.username ||
            !!u.password ||
            !!u.port
          );
        } catch {
          return true;
        }
      })
    )
      throw new Error(`Row ${index + 2}: unexpected photo address.`);
    return {
      vin,
      year,
      make: text("Make", 80),
      model: text("Model", 80),
      trim: text("Trim", 80),
      color: text("ExteriorColor", 40),
      advertised_mileage: miles ? Number(miles) : null,
      photos,
    };
  });
}
