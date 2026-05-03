"use client";

import React, { useCallback, useState } from "react";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import type { QuickViewGameContext } from "@/lib/hit-rates/quick-view";

export interface PlayerQuickViewTarget {
  mlb_player_id?: number;
  nba_player_id?: number;
  odds_player_id?: string;
  player_name: string;
  sport?: "mlb" | "nba";
  initial_market?: string;
  initial_line?: number;
  event_id?: string;
  gameContext?: QuickViewGameContext;
}

/**
 * Local state + render slot for the player quick-view modal.
 * Use it from any tool that wants to open the modal on player click:
 *
 *   const { openQuickView, quickViewElement } = usePlayerQuickView();
 *   <button onClick={() => openQuickView({ mlb_player_id, player_name })}>
 *   {quickViewElement}
 */
export function usePlayerQuickView() {
  const [target, setTarget] = useState<PlayerQuickViewTarget | null>(null);

  const openQuickView = useCallback((next: PlayerQuickViewTarget) => {
    setTarget(next);
  }, []);

  const closeQuickView = useCallback(() => setTarget(null), []);

  const quickViewElement = target ? (
    <PlayerQuickViewModal
      sport={target.sport ?? "mlb"}
      mlb_player_id={target.mlb_player_id}
      nba_player_id={target.nba_player_id}
      odds_player_id={target.odds_player_id}
      player_name={target.player_name}
      initial_market={target.initial_market}
      initial_line={target.initial_line}
      event_id={target.event_id}
      gameContext={target.gameContext}
      open={!!target}
      onOpenChange={(open) => {
        if (!open) closeQuickView();
      }}
    />
  ) : null;

  return { openQuickView, closeQuickView, quickViewElement };
}
