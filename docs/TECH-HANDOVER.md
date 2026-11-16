# Call back QR: connecting it to Insight Tracker

The QR codes open a call back request form. Our preview runs at https://insight-quote-production.up.railway.app, and you can host your own copy (see the README). Each lead is saved on the server first. It is then sent to Insight Tracker once the webhook address is set.

## What you need to do

1. Make an endpoint in Insight Tracker that accepts a JSON POST and creates a SALES LEAD task, the same as the web contact form leads.
2. Pick a shared secret if you want one.
3. Set two variables on the server (on our preview, send them to Brodie and we set them):
   - `TRACKER_WEBHOOK_URL` is your endpoint.
   - `TRACKER_WEBHOOK_SECRET` is optional. It arrives in the `X-Insight-Secret` header, so check it on your side.
4. Return any 2xx status to accept the lead. We wait up to 8 seconds.

## What we send

One POST per lead, `Content-Type: application/json`:

```json
{
  "id": "6f1c0e8a-3b1f-4f7e-9d0a-2c5b8e1a7d44",
  "at": "2026-11-10T08:30:00.000Z",
  "type": "callback",
  "consent": "callback-v1",
  "name": "Sam Citizen",
  "phone": "0412 345 678",
  "email": "sam@example.com",
  "suburb": "Parramatta",
  "pests": ["termites", "spiders"],
  "source": "qr",
  "rep": ""
}
```

| Field | Notes |
|---|---|
| id | Unique per lead. Use it to drop duplicates. |
| at | UTC time, ISO 8601 |
| phone | As typed. It is checked as an Australian number, either 04xx or a landline, and may start with +61. |
| email | Required and format checked |
| suburb | Suburb or postcode, as typed |
| pests | Optional. Any of termites, rats-mice, cockroaches, spiders, ants, wasps, silverfish, other. |
| source | `src` value from the link. The default is `qr`. |
| rep | The `rep` value from the link. It is empty for the shared QR. Codes for each rep can add `?rep=CODE`. |
| consent | The version of the consent line the person saw |

## If the webhook is down

Nothing is lost. Every lead is stored before we try to send it, and each one records the result: `pending` while it is being sent, then `sent`, `failed-<status>`, `failed` or `not-configured`. A lead left on `pending` means the server restarted mid-send, so backfill it from the CSV.

The team can see everything at `/leads`. The password is with Brodie, so don't share it in group chats. `/leads.csv` exports it all if you need to backfill.

There is no automatic retry yet. Backfill from the CSV until the endpoint is live.

## Privacy

The data is personal information: name, phone, email and suburb. The service runs on Railway, which has no Sydney region, so the data sits offshore. Once Insight Tracker is receiving leads reliably, we can clear the local copy on a schedule. Tell us how long Insight wants it kept.
