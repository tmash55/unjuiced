import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const WNBA_PLAYERS_URL = "https://www.wnba.com/players";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const overwrite = args.has("--overwrite");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function addToMultiMap(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

async function fetchOfficialPlayers() {
  const response = await fetch(WNBA_PLAYERS_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WNBA players page: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

  if (!match) {
    throw new Error("Could not find __NEXT_DATA__ on WNBA players page");
  }

  const nextData = JSON.parse(match[1]);
  const rows = nextData?.props?.pageProps?.currentPlayersData;

  if (!Array.isArray(rows)) {
    throw new Error("WNBA players page did not include currentPlayersData");
  }

  return rows.map((row) => ({
    playerId: Number(row[0]),
    lastName: row[1],
    firstName: row[2],
    name: `${row[2]} ${row[1]}`.trim(),
    slug: row[3],
    teamId: row[4] ? Number(row[4]) : null,
    teamAbbr: row[8] || null,
  }));
}

function buildOfficialIndex(players) {
  const byName = new Map();
  const byNameTeamId = new Map();
  const byNameTeamAbbr = new Map();

  for (const player of players) {
    const nameKey = normalizeName(player.name);
    addToMultiMap(byName, nameKey, player);

    if (player.teamId) {
      byNameTeamId.set(`${nameKey}:${player.teamId}`, player);
    }

    if (player.teamAbbr) {
      byNameTeamAbbr.set(`${nameKey}:${player.teamAbbr}`, player);
    }
  }

  return { byName, byNameTeamId, byNameTeamAbbr };
}

function matchOfficialPlayer(localPlayer, index) {
  const nameKey = normalizeName(localPlayer.name);

  if (localPlayer.team_id) {
    const teamIdMatch = index.byNameTeamId.get(`${nameKey}:${Number(localPlayer.team_id)}`);
    if (teamIdMatch) return { player: teamIdMatch, method: "name_team_id" };
  }

  if (localPlayer.odds_team_abbr) {
    const teamAbbrMatch = index.byNameTeamAbbr.get(`${nameKey}:${localPlayer.odds_team_abbr}`);
    if (teamAbbrMatch) return { player: teamAbbrMatch, method: "name_team_abbr" };
  }

  const nameMatches = index.byName.get(nameKey) || [];
  if (nameMatches.length === 1) {
    return { player: nameMatches[0], method: "unique_name" };
  }

  return {
    player: null,
    method: nameMatches.length > 1 ? "ambiguous_name" : "unmatched",
  };
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in environment");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const officialPlayers = await fetchOfficialPlayers();
const officialIndex = buildOfficialIndex(officialPlayers);

const { data: localPlayers, error } = await supabase
  .from("wnba_players_hr")
  .select("id, wnba_player_id, nba_player_id, name, team_id, odds_team_abbr");

if (error) {
  throw error;
}

const updates = [];
const skippedExisting = [];
const unmatched = [];
const ambiguous = [];

for (const localPlayer of localPlayers || []) {
  const match = matchOfficialPlayer(localPlayer, officialIndex);

  if (!match.player) {
    const target = match.method === "ambiguous_name" ? ambiguous : unmatched;
    target.push({
      name: localPlayer.name,
      currentId: localPlayer.wnba_player_id,
      teamId: localPlayer.team_id,
      teamAbbr: localPlayer.odds_team_abbr,
    });
    continue;
  }

  const currentHeadshotId = localPlayer.nba_player_id ? Number(localPlayer.nba_player_id) : null;
  if (currentHeadshotId && currentHeadshotId !== match.player.playerId && !overwrite) {
    skippedExisting.push({
      name: localPlayer.name,
      currentHeadshotId,
      matchedHeadshotId: match.player.playerId,
    });
    continue;
  }

  if (currentHeadshotId === match.player.playerId) {
    continue;
  }

  updates.push({
    rowId: localPlayer.id,
    name: localPlayer.name,
    previousHeadshotId: currentHeadshotId,
    headshotId: match.player.playerId,
    currentId: localPlayer.wnba_player_id,
    officialSlug: match.player.slug,
    method: match.method,
  });
}

if (apply) {
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("wnba_players_hr")
      .update({ nba_player_id: update.headshotId })
      .eq("id", update.rowId);

    if (updateError) {
      throw new Error(`Failed updating ${update.name}: ${updateError.message}`);
    }
  }
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  officialCurrentPlayers: officialPlayers.length,
  localPlayers: localPlayers?.length ?? 0,
  updates: updates.length,
  skippedExisting: skippedExisting.length,
  unmatched: unmatched.length,
  ambiguous: ambiguous.length,
  sampleUpdates: updates.slice(0, 12),
  sampleUnmatched: unmatched.slice(0, 12),
  sampleAmbiguous: ambiguous.slice(0, 12),
};

console.log(JSON.stringify(summary, null, 2));

if (!apply) {
  console.log("\nDry run only. Re-run with --apply to update wnba_players_hr.nba_player_id.");
}
