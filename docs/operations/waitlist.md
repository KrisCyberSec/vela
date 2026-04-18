# Waitlist

How email signups at [velahealth.health](https://velahealth.health) are captured, stored, and retrieved.

## How it works

```
User enters email on landing page
    ↓
POST /.netlify/functions/waitlist  { email }
    ↓
waitlist.js function (Netlify)
    ├─ Validates email format
    └─ Writes to Netlify Blobs (store = "waitlist", key = email)
    ↓
Stored record:
{
  email, submittedAt, userAgent, referrer, ip
}
```

Retrieval goes through a separate function protected by an admin token:

```
Admin loads /admin.html
    ↓
Enters ADMIN_TOKEN (saved to localStorage after first use)
    ↓
GET /.netlify/functions/waitlist-export?token=...
    ↓
waitlist-export.js function
    ├─ Validates token
    ├─ Lists all blobs in the "waitlist" store
    └─ Returns JSON or CSV
```

## Admin dashboard

**URL:** [velahealth.health/admin.html](https://velahealth.health/admin.html)

First visit asks for the admin token (stored in `ADMIN.md`). After pasting, it's saved to `localStorage["vela_admin_token"]` so you don't need to paste again on the same browser.

Features:
- Total signups + last-7-days count
- Table view: email, timestamp, referrer
- **Download CSV** button
- **Copy all emails** → clipboard
- **Sign out** (clears saved token)

## Direct API access

### JSON export

```
https://velahealth.health/.netlify/functions/waitlist-export?token=<ADMIN_TOKEN>
```

Returns:
```json
{
  "count": 42,
  "entries": [
    { "email": "...", "submittedAt": "...", "userAgent": "...", "referrer": "...", "ip": "..." }
  ]
}
```

### CSV download

Add `&format=csv`:

```
https://velahealth.health/.netlify/functions/waitlist-export?token=<ADMIN_TOKEN>&format=csv
```

## CLI access

From the `landing/` directory, Netlify CLI can read Blobs directly:

```bash
cd /Users/kristopher/Vela/landing

# List all emails
netlify blobs:list waitlist

# Get a specific entry
netlify blobs:get waitlist some@email.com
```

## Security model

- **Write endpoint** (`/.netlify/functions/waitlist`) is public — anyone can submit an email. This is intentional.
- **Read endpoint** (`/.netlify/functions/waitlist-export`) requires `ADMIN_TOKEN` as a query param.
- **Admin dashboard** (`/admin.html`) is served publicly but useless without the token.
- Token is stored as a Netlify env var (not in the codebase).

The token is also in `ADMIN.md` at the project root, which is **gitignored**.

## Rotating the admin token

If the token leaks (posted in a screenshot, sent to the wrong person, etc.):

```bash
cd /Users/kristopher/Vela/landing
NEW_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
netlify env:set ADMIN_TOKEN "$NEW_TOKEN"
netlify deploy --dir=. --functions=./netlify/functions --prod
echo "New admin token: $NEW_TOKEN"
```

Then update `ADMIN.md` with the new value. Any cached tokens in browsers will now fail login and prompt for the new one.

## What if Netlify Blobs goes down?

Blobs is a hosted Netlify service. If Netlify has an outage:
- The write endpoint returns 500 (visible in Function logs)
- The landing page UI still shows "You're on the list!" because `handleSignup` is fail-open by design (bad UX to fail visibly when we can't easily retry)
- Emails submitted during an outage are **lost** — there's no queue

If this matters more later, options:
- Add a secondary write (e.g., Zapier webhook, Airtable API) as backup
- Switch to an email service (Loops, ConvertKit) that has proper retry/queue semantics
- Move waitlist into its own DB (overkill unless signup volume is large)

## Signup volume expectations

At the current stage (pre-launch, no marketing) expect 0–5 signups/week from organic discovery. After launch and referrals kick in, maybe 20–100/week. Blobs easily handles millions of entries — storage isn't a concern.

## Related docs

- [infrastructure.md](infrastructure.md) — Netlify project details, env vars
- [deployment.md](deployment.md) — how to deploy changes to these functions
