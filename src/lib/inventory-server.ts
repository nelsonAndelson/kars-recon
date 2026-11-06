import "server-only";
import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { shopDatabase } from "./supabase";
import { fileDate, hash, parseInventory } from "./inventory";
import type { InventoryData } from "./inventory-types";
import type { Json } from "@/types/database";

// A small shared adapter for the three inventory RPC response shapes.
async function rpc(name: string, args: Record<string, Json> = {}) {
  const db = shopDatabase();
  const { data, error } = await (
    db.rpc as unknown as (
      name: string,
      args: Record<string, Json>,
    ) => Promise<{
      data: Json;
      error: { message: string; code: string } | null;
    }>
  )(name, args);
  if (error)
    throw new Error(
      error.code === "23505"
        ? "That stock number is already in use. Choose another."
        : error.message,
    );
  return data;
}
export async function getInventoryData() {
  return (await rpc("inventory_read")) as unknown as InventoryData;
}
export async function reviewInventory(payload: Json) {
  return rpc("inventory_review", { payload });
}
export async function requireImportAdmin(actor: string) {
  const { data, error } = await shopDatabase()
    .from("profiles")
    .select("id")
    .eq("id", actor)
    .eq("active", true)
    .eq("role", "owner")
    .maybeSingle();
  if (error || !data)
    throw new Error("Choose an active admin to sync inventory.");
}
async function worker(command: string, payload: Json) {
  const token = process.env.INVENTORY_WORKER_TOKEN;
  if (!token) throw new Error("Inventory connection is not configured.");
  return rpc("inventory_worker", { command, payload, token });
}
export async function syncInventory(trigger: "manual" | "scheduled") {
  const begun = (await worker("begin", { trigger })) as { id: string };
  const client = new Client(15000);
  let phase = "connection";
  try {
    if (!process.env.INVENTORY_FTP_PASSWORD)
      throw new Error("Missing configuration");
    await client.access({
      host: process.env.INVENTORY_FTP_HOST || "server122.web-hosting.com",
      port: 21,
      user: process.env.INVENTORY_FTP_USER || "dealerfeed@karsautollc.com",
      password: process.env.INVENTORY_FTP_PASSWORD,
      secure: true,
      secureOptions: { rejectUnauthorized: true },
    });
    await client.cd(process.env.INVENTORY_FTP_PATH || "/");
    phase = "download";
    const files = (await client.list())
      .filter((f) => f.isFile && fileDate(f.name))
      .sort((a, b) => b.name.localeCompare(a.name));
    const file = files[0];
    if (!file || file.size < 1 || file.size > 2_000_000)
      throw new Error("No valid file");
    const modified = await client.lastMod(file.name);
    const size = await client.size(file.name);
    let length = 0;
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        length += chunk.length;
        if (length > 2_000_000) return callback(new Error("File too large"));
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    await client.downloadTo(sink, file.name);
    if (
      length !== size ||
      (await client.size(file.name)) !== size ||
      (await client.lastMod(file.name)).getTime() !== modified.getTime()
    )
      throw new Error("File changed during download");
    phase = "validation";
    const csv = Buffer.concat(chunks).toString("utf8"),
      rows = parseInventory(csv);
    phase = "database";
    const result = await worker("finish", {
      run_id: begun.id,
      filename: file.name,
      file_date: fileDate(file.name),
      file_hash: hash(csv),
      modified_at: modified.toISOString(),
      rows,
    });
    return result;
  } catch (error) {
    // Never return raw FTP errors (which may contain host, user or credentials).
    const message =
      phase === "connection"
        ? "FTPS connection failed. Check the server certificate and deployment credentials."
        : phase === "download"
          ? "Could not retrieve a complete, stable inventory file. Retry after the export finishes."
          : phase === "validation" && error instanceof Error
            ? error.message
            : "Inventory could not be saved. No vehicles were changed; retry Sync now.";
    await worker("fail", { run_id: begun.id, error: message }).catch(() => {});
    throw new Error(message);
  } finally {
    client.close();
  }
}
