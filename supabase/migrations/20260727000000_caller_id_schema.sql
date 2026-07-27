-- ==============================================================================
-- CROWDSOURCED CALLER ID & SPAM DETECTION BACKEND SCHEMA
-- Compatible with Supabase (PostgreSQL 15+)
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------------------------
-- 1. CONTACTS TABLE
-- Stores crowd-sourced contacts with name frequencies and source submitter info
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL, -- E.164 standard (+14155552671)
    name VARCHAR(255) NOT NULL,        -- Cleaned display name
    frequency_count INT NOT NULL DEFAULT 1,
    source_user_id UUID,              -- Submitter identifier (auth.users or device id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensures uniqueness per phone_number + name pair for fast frequency upserts
    CONSTRAINT uq_contacts_phone_name UNIQUE (phone_number, name),
    CONSTRAINT chk_phone_e164 CHECK (phone_number ~ '^\+[1-9]\d{6,14}$')
);

-- B-Tree index on phone_number for sub-20ms lookups
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number 
    ON public.contacts USING btree (phone_number);

-- Composite B-Tree index to optimize top-name frequency extraction
CREATE INDEX IF NOT EXISTS idx_contacts_phone_freq 
    ON public.contacts (phone_number, frequency_count DESC, updated_at DESC);

-- B-Tree index for per-user query tracking
CREATE INDEX IF NOT EXISTS idx_contacts_source_user 
    ON public.contacts (source_user_id) WHERE source_user_id IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 2. SPAM_REPORTS TABLE
-- Log table for spam reports filed by users with category tags
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spam_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    reporter_user_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_spam_phone_e164 CHECK (phone_number ~ '^\+[1-9]\d{6,14}$'),
    CONSTRAINT chk_spam_category CHECK (
        category IN ('telemarketer', 'scam', 'robocall', 'debt_collector', 'survey', 'other')
    )
);

-- B-Tree index for sub-20ms spam lookup
CREATE INDEX IF NOT EXISTS idx_spam_reports_phone 
    ON public.spam_reports USING btree (phone_number);

-- B-Tree index for temporal report filtering and aggregation
CREATE INDEX IF NOT EXISTS idx_spam_reports_phone_time 
    ON public.spam_reports (phone_number, created_at DESC);


-- ------------------------------------------------------------------------------
-- 3. CROWDSOURCED_NAMES VIEW
-- Resolves the most frequent name submitted by users for any given phone number
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.crowdsourced_names AS
SELECT DISTINCT ON (c.phone_number)
    c.phone_number,
    c.name AS primary_name,
    c.frequency_count AS top_name_frequency,
    SUM(c.frequency_count) OVER (PARTITION BY c.phone_number) AS total_submissions,
    COUNT(c.id) OVER (PARTITION BY c.phone_number) AS distinct_names_count,
    c.updated_at AS last_updated_at
FROM public.contacts c
ORDER BY c.phone_number, c.frequency_count DESC, c.updated_at DESC;


-- ------------------------------------------------------------------------------
-- 4. STORED PROCEDURE: BULK SYNC CONTACTS
-- Efficient single-roundtrip JSON set-based bulk upsert for contact ingestion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_sync_contacts(
    p_contacts JSONB,
    p_source_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    inserted_count INT,
    updated_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inserted INT := 0;
    v_updated INT := 0;
BEGIN
    -- Temporary CTE table for normalized unnested batch input
    WITH batch_input AS (
        SELECT 
            (elem->>'phone_number')::VARCHAR(20) AS phone_number,
            TRIM(elem->>'name')::VARCHAR(255) AS name
        FROM jsonb_array_elements(p_contacts) AS elem
        WHERE (elem->>'phone_number') ~ '^\+[1-9]\d{6,14}$'
          AND NULLIF(TRIM(elem->>'name'), '') IS NOT NULL
    ),
    deduped_batch AS (
        -- Aggregate duplicate entries within the incoming batch
        SELECT 
            phone_number, 
            name, 
            COUNT(*)::INT AS batch_freq
        FROM batch_input
        GROUP BY phone_number, name
    ),
    upserted AS (
        INSERT INTO public.contacts (phone_number, name, frequency_count, source_user_id, updated_at)
        SELECT 
            phone_number, 
            name, 
            batch_freq, 
            p_source_user_id, 
            NOW()
        FROM deduped_batch
        ON CONFLICT (phone_number, name) 
        DO UPDATE SET 
            frequency_count = public.contacts.frequency_count + EXCLUDED.frequency_count,
            source_user_id = COALESCE(EXCLUDED.source_user_id, public.contacts.source_user_id),
            updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert
    )
    SELECT 
        COUNT(*) FILTER (WHERE is_insert)::INT,
        COUNT(*) FILTER (WHERE NOT is_insert)::INT
    INTO v_inserted, v_updated
    FROM upserted;

    RETURN QUERY SELECT v_inserted, v_updated;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. STORED PROCEDURE: HIGH-PERFORMANCE CALLER LOOKUP
-- Sub-10ms DB execution resolving Name, Spam Score, Risk Level & Report Stats
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_caller(
    p_phone_number VARCHAR(20)
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_primary_name VARCHAR(255);
    v_total_submissions BIGINT;
    v_total_reports BIGINT;
    v_unique_reporters BIGINT;
    v_category_counts JSONB;
    v_spam_score INT := 0;
    v_risk_level VARCHAR(25);
    v_result JSONB;
BEGIN
    -- 1. Query Top Name & Submission Metrics from crowdsourced_names view
    SELECT 
        cn.primary_name, 
        cn.total_submissions
    INTO 
        v_primary_name, 
        v_total_submissions
    FROM public.crowdsourced_names cn
    WHERE cn.phone_number = p_phone_number;

    -- 2. Query Spam Reports & Category Breakdown
    SELECT 
        COUNT(*),
        COUNT(DISTINCT reporter_user_id),
        COALESCE(jsonb_object_agg(cat, count_val) FILTER (WHERE cat IS NOT NULL), '{}'::jsonb)
    INTO 
        v_total_reports,
        v_unique_reporters,
        v_category_counts
    FROM (
        SELECT category AS cat, COUNT(*) AS count_val
        FROM public.spam_reports
        WHERE phone_number = p_phone_number
        GROUP BY category
    ) sub;

    -- 3. Calculate Heuristic Spam Score (0 - 100)
    IF v_total_reports > 0 THEN
        -- Formula: Base score on unique reporters + total reports + category weights
        v_spam_score := LEAST(100, (
            (v_unique_reporters * 15) + 
            (v_total_reports * 5) + 
            (CASE WHEN v_category_counts ? 'scam' THEN 25 ELSE 0 END) +
            (CASE WHEN v_category_counts ? 'robocall' THEN 15 ELSE 0 END)
        )::INT);
    ELSE
        v_spam_score := 0;
    END IF;

    -- 4. Map Spam Score to Risk Level
    IF v_spam_score = 0 THEN
        v_risk_level := 'SAFE';
    ELSIF v_spam_score < 30 THEN
        v_risk_level := 'LOW_RISK';
    ELSIF v_spam_score < 65 THEN
        v_risk_level := 'SUSPECTED_SPAM';
    ELSE
        v_risk_level := 'HIGH_RISK_SPAM';
    END IF;

    -- 5. Construct JSON Response Payload
    v_result := jsonb_build_object(
        'phone_number', p_phone_number,
        'name', COALESCE(v_primary_name, 'Unknown Caller'),
        'spam_score', v_spam_score,
        'risk_level', v_risk_level,
        'total_reports', v_total_reports,
        'total_submissions', COALESCE(v_total_submissions, 0),
        'categories', v_category_counts
    );

    RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Secure edge functions & direct API calls
-- ------------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spam_reports ENABLE ROW LEVEL SECURITY;

-- Read permission for authenticated and anon clients (via views/RPCs)
CREATE POLICY "Allow read access to crowdsourced caller data" 
    ON public.contacts FOR SELECT 
    USING (true);

-- Service role bypasses RLS for batch updates & sync
CREATE POLICY "Service role full access on contacts" 
    ON public.contacts FOR ALL 
    TO service_role 
    USING (true) WITH CHECK (true);

CREATE POLICY "Allow read access to spam reports" 
    ON public.spam_reports FOR SELECT 
    USING (true);

CREATE POLICY "Allow insert spam reports for authenticated users" 
    ON public.spam_reports FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = reporter_user_id);


-- ------------------------------------------------------------------------------
-- 7. STORED PROCEDURE: GET TOP N MOST REPORTED SPAM NUMBERS
-- Used by Android WorkManager for offline-first local DB pre-population
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_spam_numbers(p_limit INT DEFAULT 5000)
RETURNS TABLE (
    phone_number VARCHAR(20),
    name VARCHAR(255),
    spam_score INT,
    risk_level VARCHAR(25),
    total_reports INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH spam_agg AS (
        SELECT 
            sr.phone_number AS p_num,
            COUNT(*)::INT AS r_count,
            COUNT(DISTINCT sr.reporter_user_id)::INT AS u_reporters
        FROM public.spam_reports sr
        GROUP BY sr.phone_number
        ORDER BY r_count DESC
        LIMIT p_limit
    )
    SELECT 
        sa.p_num AS phone_number,
        COALESCE(cn.primary_name, 'Spam Caller') AS name,
        LEAST(100, (sa.u_reporters * 15 + sa.r_count * 5))::INT AS spam_score,
        (CASE 
            WHEN (sa.u_reporters * 15 + sa.r_count * 5) >= 65 THEN 'HIGH_RISK_SPAM'
            WHEN (sa.u_reporters * 15 + sa.r_count * 5) >= 30 THEN 'SUSPECTED_SPAM'
            ELSE 'LOW_RISK'
        END)::VARCHAR(25) AS risk_level,
        sa.r_count AS total_reports
    FROM spam_agg sa
    LEFT JOIN public.crowdsourced_names cn ON cn.phone_number = sa.p_num;
END;
$$;

