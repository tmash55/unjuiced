import { createClient as createServerClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

    // Use service role client to bypass RLS for contact form submissions
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Insert contact message into database
    const { data, error } = await supabase
      .from("contact_messages")
      .insert([
        {
          name,
          email,
          message,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Error saving contact message:", error);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // --- Customer.io: Identify user + track event ---
    await sendToCustomerIo({ name, email, message }).catch((err) => {
      // Log but don't fail the request if Customer.io is down
      console.error("Customer.io tracking failed:", err);
    });

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in contact API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Send identify + event to Customer.io Track API (v1).
 * Docs: https://customer.io/docs/api/track/
 */
async function sendToCustomerIo({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;

  if (!siteId || !apiKey) {
    console.warn("Customer.io credentials not configured — skipping tracking");
    return;
  }

  const auth = Buffer.from(`${siteId}:${apiKey}`).toString("base64");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic ${auth}`,
  };

  const customerId = email; // Use email as the Customer.io identifier
  const nowUnix = Math.floor(Date.now() / 1000);

  // 1. Identify the person
  await fetch(`https://track.customer.io/api/v1/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      email,
      name,
      created_at: nowUnix,
    }),
  });

  // 2. Track the contact_form_submitted event
  await fetch(`https://track.customer.io/api/v1/customers/${encodeURIComponent(customerId)}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "contact_form_submitted",
      data: {
        message,
        submitted_at: new Date().toISOString(),
        source: "website_contact_form",
      },
    }),
  });
}
