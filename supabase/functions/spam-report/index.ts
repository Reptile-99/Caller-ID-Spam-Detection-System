// Supabase Edge Function: In-App Spam Reporting API (POST /api/v1/spam-report)
// Environment: Deno Runtime
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { normalizeToE164, normalizeContactName } from "../_shared/phone_normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.phone || !body.category || !body.reporter_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, category, reporter_user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const e164Phone = normalizeToE164(body.phone, body.default_country_code || "1");
    if (!e164Phone) {
      return new Response(
        JSON.stringify({ error: "Invalid E.164 phone number format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const category = String(body.category).toLowerCase().trim();
    const validCategories = ["telemarketer", "scam", "robocall", "debt_collector", "survey", "other"];
    if (!validCategories.includes(category)) {
      return new Response(
        JSON.stringify({ error: `Invalid category. Allowed values: ${validCategories.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestedName = body.suggested_name ? normalizeContactName(body.suggested_name) : null;
    const reporterUserId = body.reporter_user_id;
    const comment = body.comment || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Insert Spam Report entry into database
    const { error: spamError } = await supabase
      .from("spam_reports")
      .insert({
        phone_number: e164Phone,
        reporter_user_id: reporterUserId,
        category: category,
        comment: comment
      });

    if (spamError) {
      console.error("Failed to insert spam report:", spamError);
      return new Response(
        JSON.stringify({ error: "Database error inserting spam report", details: spamError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. If suggested name is provided, upsert into crowdsourced contacts
    if (suggestedName) {
      await supabase.rpc("bulk_sync_contacts", {
        p_contacts: [{ phone_number: e164Phone, name: suggestedName }],
        p_source_user_id: reporterUserId
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Spam report submitted successfully.",
        phone_number: e164Phone,
        category: category
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
