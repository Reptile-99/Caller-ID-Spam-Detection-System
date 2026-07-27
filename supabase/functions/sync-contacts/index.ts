// Supabase Edge Function: Bulk Contact Ingestion API (POST /api/v1/sync-contacts)
// Environment: Deno Runtime
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { 
  normalizeToE164, 
  normalizeContactName, 
  ContactInput, 
  NormalizedContact 
} from "../_shared/phone_normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BATCH_SIZE = 2000;

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.contacts)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid request payload. Expected format: { contacts: [{ name, phone }] }" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawContacts: ContactInput[] = body.contacts;
    const defaultCountryCode: string = body.default_country_code || "1";
    const sourceUserId: string | null = body.user_id || null;

    if (rawContacts.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ 
          error: `Batch size limit exceeded. Maximum allowed contacts per request is ${MAX_BATCH_SIZE}.` 
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Normalize & Filter batch items into E.164 format
    const validContacts: NormalizedContact[] = [];
    let skippedInvalid = 0;

    for (const item of rawContacts) {
      const e164Phone = normalizeToE164(item.phone, defaultCountryCode);
      const cleanName = normalizeContactName(item.name);

      if (e164Phone && cleanName) {
        validContacts.push({
          phone_number: e164Phone,
          name: cleanName,
        });
      } else {
        skippedInvalid++;
      }
    }

    if (validContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          received_count: rawContacts.length,
          processed_count: 0,
          skipped_invalid: skippedInvalid,
          message: "No valid contacts to process.",
          duration_ms: Math.round(performance.now() - startTime)
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Initialize Supabase Admin Client using Service Role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration. Missing Supabase credentials." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Invoke set-based bulk upsert RPC procedure
    const { data: dbResult, error: dbError } = await supabase.rpc("bulk_sync_contacts", {
      p_contacts: validContacts,
      p_source_user_id: sourceUserId
    });

    if (dbError) {
      console.error("Database RPC error in bulk_sync_contacts:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to persist contact batch to database", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationMs = Math.round(performance.now() - startTime);
    const metrics = dbResult && dbResult.length > 0 ? dbResult[0] : { inserted_count: 0, updated_count: 0 };

    // 6. Return response
    return new Response(
      JSON.stringify({
        success: true,
        received_count: rawContacts.length,
        processed_count: validContacts.length,
        skipped_invalid: skippedInvalid,
        db_metrics: {
          inserted_count: metrics.inserted_count,
          updated_count: metrics.updated_count
        },
        duration_ms: durationMs
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (err: any) {
    console.error("Unhandled error in sync-contacts Edge Function:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
