import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * send-invite Edge Function
 *
 * Called via a database trigger (pg_net) when a new row is inserted into `invites`.
 * Sends an invite email through Mailpit's REST API (local dev) or a configurable
 * mail service endpoint.
 *
 * Mailpit runs inside the Docker network with alias "inbucket" on port 8025 (HTTP).
 */
// TODO: Replace Mailpit with a production email provider (e.g., Resend, SendGrid)
// via MAIL_API_URL env var. The request body format will need to change per provider.
const MAIL_API_URL = Deno.env.get("MAIL_API_URL") ?? "http://inbucket:8025/api/v1/send";

interface InviteRecord {
  email: string;
  token: string;
  role: string;
  organization_id: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: InviteRecord;
  schema: "public";
  old_record: null;
}

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || payload.table !== "invites") {
      return new Response("Ignored", { status: 200 });
    }

    const { email, token } = payload.record;
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:4200";
    const inviteUrl = `${siteUrl}/shop/invite/${token}`;

    const htmlBody = `
<html>
  <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
    <h2 style="color: #673ab7;">You've been invited!</h2>
    <p>You have been invited to join a store on <strong>CardStock</strong>.</p>
    <p>Click the button below to accept your invitation:</p>
    <p style="text-align: center; margin: 2rem 0;">
      <a href="${inviteUrl}"
         style="background-color: #673ab7; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 6px; font-weight: 500;">
        Accept Invite
      </a>
    </p>
    <p style="color: #666; font-size: 0.9rem;">
      Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a>
    </p>
  </body>
</html>`;

    console.log(`Sending invite email to ${email} with link ${inviteUrl}`);

    const mailRes = await fetch(MAIL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "noreply@cardstock.app", Name: "CardStock" },
        To: [{ Email: email }],
        Subject: "You've been invited to join a store on CardStock",
        HTML: htmlBody,
      }),
    });

    if (!mailRes.ok) {
      const errText = await mailRes.text();
      console.error("Mailpit error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await mailRes.json();
    console.log("Email sent, Mailpit ID:", result.ID);

    return new Response(JSON.stringify({ success: true, mailId: result.ID }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error sending invite email:", message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
