// Supabase Edge Function: Fast Caller Lookup API (GET /api/v1/lookup?phone=+1234567890)
// Environment: Deno Runtime
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { normalizeToE164 } from "../_shared/phone_normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, if-none-match",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Simple FNV-1a 32-bit hash implementation for deterministic ETag generation
function generateHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed. Use GET." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse query parameters
    const url = new URL(req.url);
    const rawPhone = url.searchParams.get("phone");
    const defaultCountryCode = url.searchParams.get("country_code") || "1";

    if (!rawPhone) {
      return new Response(
        JSON.stringify({ error: "Missing required query parameter: 'phone' (e.g. ?phone=+1234567890)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Normalize to E.164
    const e164Phone = normalizeToE164(rawPhone, defaultCountryCode);
    if (!e164Phone) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid phone number format. Must be a valid E.164 formatted number (e.g. +14155552671)." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration. Missing Supabase API keys." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 5. Query indexed caller database via stored RPC function
    const { data, error } = await supabase.rpc("lookup_caller", {
      p_phone_number: e164Phone
    });

    if (error) {
      console.error("RPC error during caller lookup:", error);
      return new Response(
        JSON.stringify({ error: "Failed to perform caller lookup", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lookupResult = data || {
      phone_number: e164Phone,
      name: "Unknown Caller",
      spam_score: 0,
      risk_level: "SAFE",
      total_reports: 0,
      total_submissions: 0,
      categories: {}
    };

    // 6. Generate ETag & Process Cache Validation
    const payloadStr = JSON.stringify(lookupResult);
    const etag = `W/"caller-${generateHash(payloadStr)}"`;

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          "ETag": etag,
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          "CDN-Cache-Control": "public, max-age=86400",
        }
      });
    }

    // 7. Construct Response with Aggressive HTTP Caching Headers
    // - max-age=3600: Client side cache for 1 hour
    // - s-maxage=86400: Shared / CDN cache for 24 hours
    // - stale-while-revalidate=604800: Serve stale content for up to 7 days while updating asynchronously
    const cacheHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json",
      "ETag": etag,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "CDN-Cache-Control": "public, max-age=86400",
      "Vary": "Accept-Encoding, If-None-Match"
    };

    return new Response(payloadStr, {
      status: 200,
      headers: cacheHeaders
    });

  } catch (err: any) {
    console.error("Unhandled error in lookup Edge Function:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
