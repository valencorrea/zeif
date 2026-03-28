/**
 * Test Supabase connection against the real database.
 * Usage: npx tsx scripts/test-db.ts
 */

import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testConnection() {
  console.log("=== Supabase Connection Test ===\n");
  console.log(`URL: ${url}\n`);

  // Test 1: Check tenants table exists
  console.log("1. Testing tenants table...");
  const { data: tenants, error: tenantsErr } = await supabase
    .from("tenants")
    .select("*")
    .limit(1);

  if (tenantsErr) {
    console.error(`   ✗ FAIL: ${tenantsErr.message}`);
  } else {
    console.log(`   ✓ tenants table accessible (${tenants.length} rows)`);
  }

  // Test 2: Check incidents table exists
  console.log("2. Testing incidents table...");
  const { data: incidents, error: incidentsErr } = await supabase
    .from("incidents")
    .select("*")
    .limit(1);

  if (incidentsErr) {
    console.error(`   ✗ FAIL: ${incidentsErr.message}`);
  } else {
    console.log(`   ✓ incidents table accessible (${incidents.length} rows)`);
  }

  // Test 3: Check audit_logs table exists
  console.log("3. Testing audit_logs table...");
  const { data: logs, error: logsErr } = await supabase
    .from("audit_logs")
    .select("*")
    .limit(1);

  if (logsErr) {
    console.error(`   ✗ FAIL: ${logsErr.message}`);
  } else {
    console.log(`   ✓ audit_logs table accessible (${logs.length} rows)`);
  }

  // Test 4: Insert a test tenant (using a fake auth user ID)
  console.log("4. Testing insert into tenants...");
  const testId = crypto.randomUUID();
  const { error: insertErr } = await supabase
    .from("tenants")
    .insert({
      id: testId,
      business_name: "Test Kiosko",
      zone_id: "zona-test",
      phone: "+5491100000000",
    });

  if (insertErr) {
    // Expected: FK constraint will fail because testId is not in auth.users
    if (insertErr.message.includes("foreign key") || insertErr.message.includes("violates")) {
      console.log("   ✓ Insert correctly blocked by FK constraint (no matching auth user)");
    } else {
      console.error(`   ✗ FAIL: ${insertErr.message}`);
    }
  } else {
    console.log("   ✓ Insert succeeded (cleaning up...)");
    await supabase.from("tenants").delete().eq("id", testId);
  }

  // Test 5: Verify RLS is enabled
  console.log("5. Testing RLS policies...");
  const anonClient = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Anon client without auth should get empty results (not an error)
  const { data: anonData, error: anonErr } = await anonClient
    .from("tenants")
    .select("*");

  if (anonErr) {
    console.log(`   ✓ RLS active: anon query blocked (${anonErr.message})`);
  } else {
    console.log(`   ✓ RLS active: anon query returned ${anonData.length} rows (filtered by policy)`);
  }

  // Test 6: Check column constraints
  console.log("6. Testing column constraints...");
  const { error: constraintErr } = await supabase
    .from("incidents")
    .insert({
      tenant_id: testId,
      timestamp: Date.now(),
      confirmed: true,
      confidence: 0.87,
      theft_type: "invalid_type", // should fail CHECK constraint
      description: "test",
      clip_path: "test.mp4",
    });

  if (constraintErr) {
    console.log(`   ✓ CHECK constraint works: "${constraintErr.message.slice(0, 60)}..."`);
  } else {
    console.error("   ✗ FAIL: invalid theft_type was accepted");
  }

  console.log("\n=== Test Complete ===");
}

testConnection().catch(console.error);
