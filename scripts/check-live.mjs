import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const vehicles = await db.from("vehicles").select("id,stock_number");
assert.equal(vehicles.error, null);
assert.equal(
  vehicles.data.filter((v) => v.stock_number.startsWith("DEMO-")).length,
  12,
);
const rates = await db.from("tech_pay_rates").select("*");
assert.equal(rates.error, null);
assert.equal(rates.data.length, 6);
// A no-op UPDATE against a nonexistent stock verifies write denial without touching records.
const denied = await db
  .from("vehicles")
  .update({ make: "test" })
  .eq("stock_number", "DOES-NOT-EXIST-ACCESS-CHECK");
assert.ok(denied.error, "Anonymous UPDATE must fail");
assert.equal(denied.error.code, "42501");
console.log(
  "Live Supabase passed: 12 demo vehicles, 6 rate records, anonymous writes denied.",
);
