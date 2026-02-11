import { normalizePlanName } from "@unjuiced/types";
import type { Entitlements } from "@unjuiced/types";
import type { ArbMode, GetArbsResponse } from "@unjuiced/types";
import type {
  DevigMethod,
  EVMode,
  GetSharpPresetsResponse,
  PlayerBoxScoresResponse,
  HitRateSortField,
  HitRatesV2Response,
  PositiveEVResponse,
  SharpPreset
} from "@unjuiced/types";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface GetMePlanOptions {
  accessToken?: string;
}

export interface GetArbsOptions {
  accessToken?: string;
  v?: number;
  limit?: number;
  cursor?: number;
  eventId?: string;
  mode?: ArbMode;
}

export interface GetPositiveEVOptions {
  accessToken?: string;
  sports?: string[];
  markets?: string[];
  books?: string[];
  sharpPreset?: SharpPreset;
  devigMethods?: DevigMethod[];
  mode?: EVMode;
  minEV?: number;
  maxEV?: number;
  minBooksPerSide?: number;
  limit?: number;
}

export interface GetSharpPresetsOptions {
  accessToken?: string;
}

export interface GetNbaHitRatesV2Options {
  accessToken?: string;
  date?: string;
  market?: string;
  minHitRate?: number;
  limit?: number;
  offset?: number;
  search?: string;
  playerId?: number;
  sort?: HitRateSortField;
  sortDir?: "asc" | "desc";
  hasOdds?: boolean;
}

export interface HitRateOddsSelection {
  stableKey: string;
  line?: number;
}

export interface HitRateOddsResponse {
  odds: Record<
    string,
    {
      stableKey: string;
      eventId?: string | null;
      market?: string | null;
      primaryLine?: number | null;
      bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
      bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
      currentLine: number | null;
      allLines?: Array<{
        line: number;
        bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
        bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
        books: Record<
          string,
          {
            over?: { price: number; url: string | null; mobileUrl: string | null; sgp: string | null };
            under?: { price: number; url: string | null; mobileUrl: string | null; sgp: string | null };
          }
        >;
      }>;
      live: boolean;
      timestamp: number | null;
    }
  >;
}

export interface GetNbaHitRateOddsOptions {
  accessToken?: string;
  selections: HitRateOddsSelection[];
}

export interface GetNbaPlayerBoxScoresOptions {
  accessToken?: string;
  playerId: number;
  season?: string;
  limit?: number;
}

export function createApiClient(options: ApiClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.trim().replace(/\/$/, "");

  return {
    async getMePlan(requestOptions?: GetMePlanOptions): Promise<Entitlements> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/me/plan`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { plan: "free", authenticated: false };
        }
        throw new Error(`Failed to fetch entitlements: ${response.status}`);
      }

      const payload = (await response.json()) as Entitlements;
      return {
        ...payload,
        plan: normalizePlanName(payload.plan)
      };
    },
    async getArbs(requestOptions?: GetArbsOptions): Promise<GetArbsResponse | null> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.v != null) params.set("v", String(requestOptions.v));
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.cursor != null) params.set("cursor", String(requestOptions.cursor));
      if (requestOptions?.eventId) params.set("event_id", requestOptions.eventId);
      if (requestOptions?.mode) params.set("mode", requestOptions.mode);

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/arbs${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (response.status === 304) return null;

      if (!response.ok) {
        throw new Error(`Failed to fetch arbitrage rows: ${response.status}`);
      }

      const payload = (await response.json()) as GetArbsResponse;
      return {
        ...payload,
        plan: normalizePlanName(String(payload.plan))
      };
    },
    async getPositiveEV(requestOptions?: GetPositiveEVOptions): Promise<PositiveEVResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.sports?.length) params.set("sports", requestOptions.sports.join(","));
      if (requestOptions?.markets?.length) params.set("markets", requestOptions.markets.join(","));
      if (requestOptions?.books?.length) params.set("books", requestOptions.books.join(","));
      if (requestOptions?.sharpPreset) params.set("sharpPreset", requestOptions.sharpPreset);
      if (requestOptions?.devigMethods?.length) params.set("devigMethods", requestOptions.devigMethods.join(","));
      if (requestOptions?.mode) params.set("mode", requestOptions.mode);
      if (requestOptions?.minEV != null) params.set("minEV", String(requestOptions.minEV));
      if (requestOptions?.maxEV != null) params.set("maxEV", String(requestOptions.maxEV));
      if (requestOptions?.minBooksPerSide != null) {
        params.set("minBooksPerSide", String(requestOptions.minBooksPerSide));
      }
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/v2/positive-ev${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positive EV rows: ${response.status}`);
      }

      return (await response.json()) as PositiveEVResponse;
    },
    async getSharpPresets(requestOptions?: GetSharpPresetsOptions): Promise<GetSharpPresetsResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/v2/positive-ev/presets`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sharp presets: ${response.status}`);
      }

      return (await response.json()) as GetSharpPresetsResponse;
    },
    async getNbaHitRatesV2(requestOptions?: GetNbaHitRatesV2Options): Promise<HitRatesV2Response> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.date) params.set("date", requestOptions.date);
      if (requestOptions?.market) params.set("market", requestOptions.market);
      if (requestOptions?.minHitRate != null) params.set("minHitRate", String(requestOptions.minHitRate));
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.offset != null) params.set("offset", String(requestOptions.offset));
      if (requestOptions?.search) params.set("search", requestOptions.search);
      if (requestOptions?.playerId != null) params.set("playerId", String(requestOptions.playerId));
      if (requestOptions?.sort) params.set("sort", requestOptions.sort);
      if (requestOptions?.sortDir) params.set("sortDir", requestOptions.sortDir);
      if (requestOptions?.hasOdds != null) params.set("hasOdds", String(requestOptions.hasOdds));

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/hit-rates/v2${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch hit rates: ${response.status}`);
      }

      return (await response.json()) as HitRatesV2Response;
    },
    async getNbaPlayerBoxScores(requestOptions: GetNbaPlayerBoxScoresOptions): Promise<PlayerBoxScoresResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      params.set("playerId", String(requestOptions.playerId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/player-box-scores?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch player box scores: ${response.status}`);
      }

      return (await response.json()) as PlayerBoxScoresResponse;
    },
    async getNbaHitRateOdds(requestOptions: GetNbaHitRateOddsOptions): Promise<HitRateOddsResponse> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/nba/hit-rates/odds`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify({ selections: requestOptions.selections })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch hit rate odds: ${response.status}`);
      }

      return (await response.json()) as HitRateOddsResponse;
    }
  };
}
