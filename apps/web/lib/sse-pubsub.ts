/**
 * Shared SSE pub/sub helpers for VPS Redis REST proxy.
 *
 * The VPS wraps pub/sub messages as:  ["channel", "payload"]
 * Our clients expect raw JSON:        {"v":..., "add":..., ...}
 *
 * These helpers unwrap the channel array and provide a reusable pump
 * that can be plugged into any SSE route.
 */

const enc = new TextEncoder();

/**
 * Unwrap a VPS Redis REST pub/sub SSE data line.
 *
 * SUBSCRIBE  → ["channel", "payload"]            (2 elements)
 * PSUBSCRIBE → ["pattern", "channel", "payload"] (3 elements)
 *
 * In both cases the actual message is the **last** string element.
 *
 *  - {"subscribed":"..."}  /  {"psubscribed":"..."} →  null  (skip confirmations)
 *  - anything else                                  →  returned as-is
 */
export function unwrapPubSubData(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);

    // Array envelope from SUBSCRIBE or PSUBSCRIBE — payload is always last
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const last = parsed[parsed.length - 1];
      if (typeof last === "string") return last;
      if (last && typeof last === "object") return JSON.stringify(last);
      return null;
    }

    // Subscription/psubscription confirmations — skip
    if (parsed && typeof parsed === "object" && ("subscribed" in parsed || "psubscribed" in parsed)) {
      return null;
    }
  } catch {
    // Not JSON — pass through as-is
  }
  return raw;
}

/**
 * Pump a single upstream SSE from Redis pub/sub → client writer,
 * unwrapping ["channel", "payload"] format along the way.
 *
 * @param filter  Optional callback. Return the string to forward,
 *                or null to skip the message entirely.
 */
export async function pumpPubSub(opts: {
  upstream: ReadableStream<Uint8Array>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  signal: AbortSignal;
  helloEvent?: string;
  filter?: (payload: string) => string | null;
}) {
  const { upstream, writer, signal, helloEvent, filter } = opts;
  const reader = upstream.getReader();
  const dec = new TextDecoder();

  const safeWrite = async (data: Uint8Array) => {
    try { await writer.write(data); } catch { throw new Error("closed"); }
  };

  // Hello event
  if (helloEvent) {
    try { await safeWrite(enc.encode(helloEvent)); } catch { return; }
  }

  // Keepalive pings
  const PING_MS = 15_000;
  const ping = setInterval(async () => {
    try { await safeWrite(enc.encode(`: ping\n\n`)); } catch { clearInterval(ping); }
  }, PING_MS);

  let closed = false;
  const cleanup = () => {
    clearInterval(ping);
    if (!closed) { closed = true; writer.close().catch(() => {}); }
  };

  if (signal.aborted) { cleanup(); return; }
  signal.addEventListener("abort", cleanup, { once: true });

  let buffer = "";

  try {
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      finished = !!done;
      if (finished) break;

      buffer += dec.decode(value!, { stream: true });

      // Process complete SSE events (terminated by \n\n)
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        // Pass through comment lines (: ping from upstream)
        if (rawEvent.startsWith(":")) {
          try { await safeWrite(enc.encode(rawEvent + "\n\n")); } catch { finished = true; break; }
          continue;
        }

        // Extract data from SSE event lines
        let data = "";
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data: ")) data += line.slice(6);
          else if (line.startsWith("data:")) data += line.slice(5);
        }

        if (!data) continue;

        let payload = unwrapPubSubData(data);
        if (payload === null) continue; // subscription confirmation — skip

        // Apply optional filter/transform
        if (filter) {
          payload = filter(payload);
          if (payload === null) continue;
        }

        try { await safeWrite(enc.encode(`data: ${payload}\n\n`)); } catch { finished = true; break; }
      }
    }
  } finally {
    cleanup();
  }
}

/**
 * Pump **multiple** upstream pub/sub streams into a single client writer.
 *
 * Used when the VPS doesn't support PSUBSCRIBE — we open one SUBSCRIBE
 * per channel and merge them here.  Each upstream gets its own read-loop
 * and buffer so interleaved chunks can't corrupt each other.
 */
export async function pumpMultiPubSub(opts: {
  upstreams: ReadableStream<Uint8Array>[];
  writer: WritableStreamDefaultWriter<Uint8Array>;
  signal: AbortSignal;
  helloEvent?: string;
  filter?: (payload: string) => string | null;
}) {
  const { upstreams, writer, signal, helloEvent, filter } = opts;

  const safeWrite = async (data: Uint8Array) => {
    try { await writer.write(data); } catch { throw new Error("closed"); }
  };

  if (helloEvent) {
    try { await safeWrite(enc.encode(helloEvent)); } catch { return; }
  }

  const PING_MS = 15_000;
  const ping = setInterval(async () => {
    try { await safeWrite(enc.encode(`: ping\n\n`)); } catch { clearInterval(ping); }
  }, PING_MS);

  let closed = false;
  const cleanup = () => {
    clearInterval(ping);
    if (!closed) { closed = true; writer.close().catch(() => {}); }
  };

  if (signal.aborted) { cleanup(); return; }
  signal.addEventListener("abort", cleanup, { once: true });

  const pumpOne = async (upstream: ReadableStream<Uint8Array>) => {
    const reader = upstream.getReader();
    const dec = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += dec.decode(value!, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          if (rawEvent.startsWith(":")) continue; // skip upstream pings

          let data = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("data: ")) data += line.slice(6);
            else if (line.startsWith("data:")) data += line.slice(5);
          }
          if (!data) continue;

          let payload = unwrapPubSubData(data);
          if (payload === null) continue;

          if (filter) {
            payload = filter(payload);
            if (payload === null) continue;
          }

          // safeWrite throws on closed writer, exiting this pump
          await safeWrite(enc.encode(`data: ${payload}\n\n`));
        }
      }
    } catch {
      // Writer closed or stream ended — exit gracefully
    }
  };

  try {
    await Promise.allSettled(upstreams.map(u => pumpOne(u)));
  } finally {
    cleanup();
  }
}
