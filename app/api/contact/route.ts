import { createClient as createServerClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ── Customer.io config ───────────────────────────────────────────────

const CIO_SITE_ID = process.env.CUSTOMERIO_SITE_ID;
const CIO_TRACKING_KEY = process.env.CUSTOMERIO_API_KEY; // Track API key
const CIO_APP_KEY = process.env.CUSTOMERIO_APP_API_KEY; // App API key (transactional)

function trackAuth() {
  return `Basic ${Buffer.from(`${CIO_SITE_ID}:${CIO_TRACKING_KEY}`).toString("base64")}`;
}

/** Identify a person in Customer.io (Track API) */
async function cioIdentify(email: string, attributes: Record<string, unknown>) {
  const res = await fetch(
    `https://track.customer.io/api/v1/customers/${encodeURIComponent(email)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: trackAuth(),
      },
      body: JSON.stringify({ email, ...attributes }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customer.io identify failed (${res.status}): ${text}`);
  }
}

/** Track an event for a person (Track API) */
async function cioTrackEvent(
  email: string,
  eventName: string,
  data: Record<string, unknown>
) {
  const res = await fetch(
    `https://track.customer.io/api/v1/customers/${encodeURIComponent(email)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: trackAuth(),
      },
      body: JSON.stringify({ name: eventName, data }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customer.io event failed (${res.status}): ${text}`);
  }
}

/** Send a transactional email (App API) */
async function cioSendTransactional({
  to,
  subject,
  body,
  from = "Unjuiced Team <hello@unjuiced.bet>",
  replyTo,
  identifiers,
}: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  identifiers?: { email: string };
}) {
  const payload: Record<string, unknown> = {
    transactional_message_id: 1,
    to,
    from,
    subject,
    body,
    identifiers: identifiers ?? { email: to },
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch("https://api.customer.io/v1/send/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CIO_APP_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customer.io transactional failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Email templates ──────────────────────────────────────────────────

function autoReplyHtml(name: string) {
  const logoUrl = "https://unjuiced.bet/logo.png";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#07131A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#07131A;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:32px;">
              <a href="https://unjuiced.bet" style="text-decoration:none;">
                <img src="${logoUrl}" alt="Unjuiced" width="36" height="36" style="border:0;display:inline;vertical-align:middle;border-radius:8px;" />
                <span style="font-size:22px;font-weight:700;color:#38BDF8;letter-spacing:-0.5px;margin-left:10px;vertical-align:middle;">Unjuiced</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0B1014;border-radius:12px;padding:36px 32px;border:1px solid #1E293B;">
              <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#F8FAFC;">
                Hey ${name} 👋
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#94A3B8;">
                We got your message — thanks for reaching out. Someone from the team will get back to you soon, usually within 24 hours.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#94A3B8;">
                In the meantime, if you have anything else to add, just reply to this email.
              </p>
              <p style="margin:0 0 24px;">
                <a href="https://unj.bet/6qfDqU9" style="display:inline-block;background-color:#0EA5E9;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">Explore Our Tools →</a>
              </p>
              <p style="margin:0;font-size:15px;color:#94A3B8;">
                — The Unjuiced Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                Unjuiced · Bet smarter in seconds.
              </p>
              <p style="margin:8px 0 0;font-size:12px;">
                <a href="https://unjuiced.bet" style="color:#38BDF8;text-decoration:none;">unjuiced.bet</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function internalNotificationHtml({
  name,
  email,
  message,
  submittedAt,
}: {
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}) {
  // Escape HTML in user-provided fields to prevent injection
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const logoUrl = "https://unjuiced.bet/logo.png";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#07131A;">
  <div style="max-width:560px;margin:0 auto;background:#0B1014;border-radius:12px;padding:28px;border:1px solid #1E293B;">
    <div style="margin-bottom:20px;">
      <img src="${logoUrl}" alt="Unjuiced" width="28" height="28" style="border:0;display:inline;vertical-align:middle;border-radius:6px;" />
      <span style="font-size:16px;font-weight:700;color:#38BDF8;margin-left:8px;vertical-align:middle;">Unjuiced</span>
      <span style="font-size:14px;color:#475569;margin-left:8px;vertical-align:middle;">· Internal</span>
    </div>
    <h2 style="margin:0 0 16px;font-size:18px;color:#F8FAFC;">📬 New Contact Form Submission</h2>
    <table style="width:100%;font-size:14px;color:#94A3B8;">
      <tr><td style="padding:8px 0;font-weight:600;width:80px;color:#CBD5E1;">Name</td><td style="padding:8px 0;">${esc(name)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:600;color:#CBD5E1;">Email</td><td style="padding:8px 0;"><a href="mailto:${esc(email)}" style="color:#38BDF8;text-decoration:none;">${esc(email)}</a></td></tr>
      <tr><td style="padding:8px 0;font-weight:600;color:#CBD5E1;">Time</td><td style="padding:8px 0;">${submittedAt}</td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #1E293B;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#CBD5E1;">Message:</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#94A3B8;white-space:pre-wrap;background:#131A22;padding:12px;border-radius:8px;">${esc(message)}</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #1E293B;">
    <p style="margin:0;font-size:12px;color:#475569;">Reply directly to <a href="mailto:${esc(email)}" style="color:#38BDF8;text-decoration:none;">${esc(email)}</a> to respond.</p>
  </div>
</body>
</html>`;
}

// ── Main route ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Save to Supabase
    const { data, error } = await supabase
      .from("contact_messages")
      .insert([{ name, email, message, created_at: new Date().toISOString() }])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // 2. Customer.io — all calls run in background (don't block response)
    const trackingEnabled = CIO_SITE_ID && CIO_TRACKING_KEY;
    const transactionalEnabled = CIO_APP_KEY;
    const submittedAt = new Date().toISOString();

    const cioTasks: Promise<unknown>[] = [];

    if (trackingEnabled) {
      // Identify the person + track the event
      cioTasks.push(
        cioIdentify(email, {
          name,
          lead_source: "contact_form",
          created_at: Math.floor(Date.now() / 1000),
        })
      );
      cioTasks.push(
        cioTrackEvent(email, "contact_form_submitted", {
          message,
          submitted_at: submittedAt,
          source: "website_contact_form",
        })
      );
    }

    if (transactionalEnabled) {
      // Auto-reply to the user
      cioTasks.push(
        cioSendTransactional({
          to: email,
          subject: `Got it, ${name}! We'll be in touch 🤙`,
          body: autoReplyHtml(name),
          replyTo: "support@unjuiced.bet",
          identifiers: { email },
        })
      );

      // Internal notification to support team
      cioTasks.push(
        cioSendTransactional({
          to: "support@unjuiced.bet",
          subject: `📬 New contact form: ${name} (${email})`,
          body: internalNotificationHtml({ name, email, message, submittedAt }),
          replyTo: email,
          identifiers: { email: "support@unjuiced.bet" },
        })
      );
    }

    if (cioTasks.length > 0) {
      Promise.allSettled(cioTasks).then((results) => {
        const labels = ["identify", "event", "auto-reply", "internal-notify"];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(`Customer.io ${labels[i]} failed:`, r.reason);
          }
        });
      });
    } else {
      console.warn(
        "Customer.io credentials not configured — skipping tracking & emails"
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
