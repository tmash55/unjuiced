"use client";

import React from "react";

export function Controls(props: {
  pro: boolean;
  connected: boolean;
  onRefresh: () => void;
  eventId?: string;
  setEventId: (v?: string) => void;
  cursor: number;
  hasMore: boolean;
  nextPage: () => void;
  prevPage: () => void;
}) {
  const { pro, connected, onRefresh, eventId, setEventId, cursor, hasMore, nextPage, prevPage } = props;
  return (
    <div className="flex items-center gap-3">
      <button onClick={onRefresh} className="px-3 py-1 rounded bg-neutral-800 text-white">Refresh</button>
      {pro ? (
        <span className={`text-sm ${connected ? "text-green-600" : "text-amber-600"}`}>
          {connected ? "Live (SSE)" : "Reconnecting…"}
        </span>
      ) : (
        <span className="text-sm text-gray-500">Manual refresh (Free)</span>
      )}
      <div className="ml-4 flex items-center gap-2">
        <label className="text-sm text-gray-500">Event:</label>
        <input
          className="border rounded px-2 py-1 text-sm"
          placeholder="event_id (optional)"
          value={eventId ?? ""}
          onChange={(e) => setEventId(e.target.value || undefined)}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={prevPage} disabled={cursor === 0} className="px-2 py-1 border rounded disabled:opacity-50">Prev</button>
        <button onClick={nextPage} disabled={!hasMore} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}