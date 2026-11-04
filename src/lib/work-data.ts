import { shopDatabase } from "./supabase";
import { payReportSchema, type WorkData } from "./jobs";
export async function getWorkData(): Promise<WorkData> {
  const { data, error } = await shopDatabase().rpc("work_data");
  if (error || !data)
    throw new Error("Could not load jobs and rates. Please refresh.");
  return data as unknown as WorkData;
}
export async function getPayReport(start: string) {
  const { data, error } = await shopDatabase().rpc("pay_week_report", {
    start_date: start,
  });
  if (error) throw new Error(error.message);
  return payReportSchema.parse(data);
}
