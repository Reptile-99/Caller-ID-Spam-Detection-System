# Crowdsourced Caller ID & Spam Detection Backend

Production-ready backend architecture for an Android Caller ID and Spam Detection app using **Supabase (PostgreSQL 15+ & Edge Functions)**.

---

## 🛠️ Project Structure

```
truecaller project/
├── .gitignore                         # Git exclusion rules for node, android, flutter
├── Database & Backend Architecture    # System design & benchmark documentation
├── android/                           # Android Native engine (Kotlin, CallScreeningService, Overlay)
├── flutter_app/                       # Flutter app frontend (Dart, pubspec.yaml, screens)
├── src/                               # React Native app frontend (TypeScript/TSX)
├── supabase/                          # Supabase PostgreSQL migrations & Deno Edge Functions
├── test_suite.ps1                     # 54-point verification test suite
└── README.md                          # API testing, Git setup & deployment guide
```

---

## 📦 Git Repository Deployment

To initialize and push this project to GitHub or any remote Git repository:

```bash
# 1. Initialize local Git repository
git init

# 2. Stage all project files (ignoring build & secret files via .gitignore)
git add .

# 3. Commit initial project state
git commit -m "feat: Initial commit of Caller ID & Spam Detection System (Supabase + Android + Flutter)"

# 4. Rename main branch
git branch -M main

# 5. Add remote GitHub repository URL
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 6. Push to GitHub
git push -u origin main
```


---

## 🚀 Quick Setup & Deployment

### 1. Apply Database Schema Migration
Push the database schema, B-Tree indexes, views, and RPC stored procedures to your Supabase PostgreSQL project:
```bash
npx supabase db push
```

### 2. Deploy Edge Functions
Deploy both functions to your Supabase project:
```bash
npx supabase functions deploy sync-contacts --no-verify-jwt
npx supabase functions deploy lookup --no-verify-jwt
```

---

## 📡 API Reference

### 1. Bulk Contact Ingestion (`POST /api/v1/sync-contacts`)
Normalizes incoming contacts to E.164 format and upserts them using set-based SQL procedures.

**Request**: `POST /functions/v1/sync-contacts`
```json
{
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "default_country_code": "1",
  "contacts": [
    { "name": "John Doe", "phone": "+1 (415) 555-2671" },
    { "name": "Telemarketer", "phone": "01712345678" }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "received_count": 2,
  "processed_count": 2,
  "skipped_invalid": 0,
  "db_metrics": {
    "inserted_count": 1,
    "updated_count": 1
  },
  "duration_ms": 35
}
```

---

### 2. Fast Caller Lookup (`GET /api/v1/lookup?phone=+14155552671`)
Performs point lookup using B-Tree indexes and returns risk assessment with aggressive HTTP/CDN caching.

**Request**: `GET /functions/v1/lookup?phone=+14155552671`

**Response Headers**:
```http
Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
CDN-Cache-Control: public, max-age=86400
ETag: W/"caller-7f4a2b9"
Vary: Accept-Encoding, If-None-Match
```

**Response JSON**:
```json
{
  "phone_number": "+14155552671",
  "name": "Spam Telemarketing Inc",
  "spam_score": 85,
  "risk_level": "HIGH_RISK_SPAM",
  "total_reports": 42,
  "total_submissions": 12,
  "categories": {
    "telemarketer": 30,
    "scam": 12
  }
}
```
