import { syncActivity } from "@/lib/activity-store";

// Reading a week of ledgers from the RPC on a cold start can take a few seconds.
export const maxDuration = 30;

/**
 * Every pool and receivables event since deployment, newest first. Also the
 * target of the daily cron in vercel.json, which keeps the stored history
 * current even when nobody opens the app.
 */
export async function GET() {
  try {
    const history = await syncActivity();
    return Response.json(history, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("api/activity", err);
    return Response.json({ error: "Could not read activity" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
