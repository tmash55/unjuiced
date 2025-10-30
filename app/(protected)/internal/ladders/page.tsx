"use client";

import React from "react";
import { getFamily, findSid, openAltSSE, type Sport } from "@/libs/ladders/client";

export default function LaddersTester() {
  const [sport, setSport] = React.useState<Sport>("nfl");
  const [eid, setEid] = React.useState("");
  const [mkt, setMkt] = React.useState("");
  const [ent, setEnt] = React.useState("");
  const [sid, setSid] = React.useState("");
  const [sids, setSids] = React.useState<string[]>([]);
  const [family, setFamily] = React.useState<any>(null);
  const [etag, setEtag] = React.useState<string | undefined>(undefined);
  const [events, setEvents] = React.useState<{ id: string; sid: string }[]>([]);
  const esRef = React.useRef<EventSource | null>(null);

  const appendEvent = (e: { id: string; sid: string }) => {
    setEvents((prev) => [e, ...prev].slice(0, 50));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Ladders Tester</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex gap-2">
            <select value={sport} onChange={(e) => setSport(e.target.value as Sport)} className="rounded border px-2 py-1">
              <option value="nfl">NFL</option>
              <option value="nba">NBA</option>
              <option value="nhl">NHL</option>
              <option value="ncaaf">NCAAF</option>
            </select>
            <input placeholder="eid" value={eid} onChange={(e) => setEid(e.target.value)} className="flex-1 rounded border px-2 py-1" />
          </div>
          <div className="mb-3 flex gap-2">
            <input placeholder="market (mkt)" value={mkt} onChange={(e) => setMkt(e.target.value)} className="flex-1 rounded border px-2 py-1" />
            <input placeholder="player/ent" value={ent} onChange={(e) => setEnt(e.target.value)} className="flex-1 rounded border px-2 py-1" />
          </div>
          <button
            className="rounded bg-neutral-900 px-3 py-2 text-white"
            onClick={async () => {
              const r = await findSid({ sport, mkt, player: ent, eid });
              setSids(r.sids);
              if (r.sids[0]) setSid(r.sids[0]);
            }}
          >Find SID</button>

          <div className="mt-3 text-sm text-neutral-600">SIDs: {sids.join(", ") || "(none)"}</div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 flex gap-2">
            <input placeholder="sid" value={sid} onChange={(e) => setSid(e.target.value)} className="flex-1 rounded border px-2 py-1" />
            <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={async () => {
              if (!sid) return;
              const r = await getFamily(sport, sid, etag);
              if (r.status === 304) return;
              setFamily(r.body);
              setEtag(r.etag);
            }}>Load Family</button>
          </div>
          <div className="mb-3 flex gap-2">
            <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={() => {
              if (esRef.current) return;
              esRef.current = openAltSSE({ sport, sids: sid ? [sid] : sids, onAlt: async ({ id, sid }) => {
                appendEvent({ id, sid });
                // refetch family on event
                try {
                  const r = await getFamily(sport, sid, etag);
                  if (r.status !== 304) { setFamily(r.body); setEtag(r.etag); }
                } catch {}
              }});
            }}>Start SSE</button>
            <button className="rounded bg-red-600 px-3 py-2 text-white" onClick={() => {
              esRef.current?.close();
              esRef.current = null;
            }}>Stop SSE</button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Family</h2>
          <pre className="max-h-[480px] overflow-auto text-xs">{family ? JSON.stringify(family, null, 2) : "(no family)"}</pre>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Events</h2>
          <pre className="max-h-[480px] overflow-auto text-xs">{events.map(e => `${e.id} :: ${e.sid}`).join("\n") || "(no events)"}</pre>
        </div>
      </div>
    </div>
  );
}


