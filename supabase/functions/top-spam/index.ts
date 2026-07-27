// Supabase Edge Function: Top Spam List Download API (GET /api/v1/top-spam?limit=5000)
// Environment: Deno Runtime
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req: Request) => {
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

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5000", 10), 10000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // SQL query to fetch top N reported spam numbers with associated names and spam metrics
    const { data, error } = await supabase.rpc("get_top_spam_numbers", {
      p_limit: limit
    });

    if (error) {
      // Fallback query if RPC isn't loaded yet
      const { data: rawData, error: rawError } = await supabase
        .from("spam_reports")
        .select("phone_number")
        .limit(limit);

      if (rawError) {
        return new Response(
          JSON.stringify({ error: "Database query failed", details: rawError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ count: rawData.length, items: rawData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        count: (data || []).length,
        items: data || []
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "CDN-Cache-Control": "public, max-age=86400"
        }
      }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
