export const STAGES = [
  "purchased",
  "in_transit",
  "check_in",
  "diagnosis",
  "repair",
  "qc",
  "detail",
  "photos",
  "frontline",
  "sold",
] as const;
export const STAGE_LABELS: Record<Stage, string> = {
  purchased: "Purchased",
  in_transit: "In transit",
  check_in: "Check-in",
  diagnosis: "Diagnosis",
  repair: "Repair",
  qc: "QC",
  detail: "Detail",
  photos: "Photos",
  frontline: "Frontline",
  sold: "Sold",
};
export type Stage = (typeof STAGES)[number];
export const BLOCKERS = [
  "waiting_parts",
  "waiting_approval",
  "waiting_diagnosis",
  "at_sublet",
  "no_tech_available",
  "other",
] as const;
export const ROLES = ["owner", "tech", "advisor", "viewer"] as const;
export const SHOP_TIMEZONE = "America/New_York";
