/**
 * Quick test script to call get_nrfi_cheatsheets_v2 RPC and inspect the response shape.
 * Run: npx tsx scripts/test-nrfi-rpc.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Use today's date in ET, or override for testing
  const override = process.argv[2]; // pass a date like 2025-07-15 as arg
  const today = override || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  console.log("Calling get_nrfi_cheatsheet for date:", today);

  // Try v2 first (the one you just created), fall back to v1
  let data: any = null;
  let error: any = null;

  ({ data, error } = await sb.rpc("get_nrfi_cheatsheet_v2", {
    p_game_date: today,
  }));

  if (error) {
    console.log("v2 failed, trying v1:", error.message);
    ({ data, error } = await sb.rpc("get_nrfi_cheatsheet", {
      p_game_date: today,
    }));
  }

  if (error) {
    console.error("RPC error:", error);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`\n✅ Returned ${rows.length} rows\n`);

  if (rows.length === 0) {
    // Try yesterday or tomorrow
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    console.log("No rows for today. Trying yesterday:", yesterday);
    let data2: any = null;
    let error2: any = null;
    ({ data: data2, error: error2 } = await sb.rpc("get_nrfi_cheatsheet_v2", {
      p_game_date: yesterday,
    }));
    if (error2) {
      ({ data: data2, error: error2 } = await sb.rpc("get_nrfi_cheatsheet", {
        p_game_date: yesterday,
      }));
    }
    if (error2) {
      console.error("RPC error (yesterday):", error2);
      process.exit(1);
    }
    const rows2 = data2 ?? [];
    console.log(`Yesterday returned ${rows2.length} rows\n`);
    if (rows2.length > 0) {
      console.log("=== Column names (keys) ===");
      console.log(Object.keys(rows2[0]).sort().join("\n"));
      console.log("\n=== First row (full) ===");
      console.log(JSON.stringify(rows2[0], null, 2));
      if (rows2.length > 1) {
        console.log("\n=== Second row (full) ===");
        console.log(JSON.stringify(rows2[1], null, 2));
      }
    }
    return;
  }

  console.log("=== Column names (keys) ===");
  console.log(Object.keys(rows[0]).sort().join("\n"));
  console.log("\n=== First row (full) ===");
  console.log(JSON.stringify(rows[0], null, 2));
  if (rows.length > 1) {
    console.log("\n=== Second row (full) ===");
    console.log(JSON.stringify(rows[1], null, 2));
  }
}

main();
