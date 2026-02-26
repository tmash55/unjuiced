import type { DrilldownSport, DrilldownSportModule } from "@/components/hit-rates/drilldown/types";
import { mlbDrilldownModule } from "@/components/hit-rates/drilldown/modules/mlb";
import { nbaDrilldownModule } from "@/components/hit-rates/drilldown/modules/nba";
import { wnbaDrilldownModule } from "@/components/hit-rates/drilldown/modules/wnba";

const DRILLDOWN_MODULES: Record<DrilldownSport, DrilldownSportModule> = {
  nba: nbaDrilldownModule,
  mlb: mlbDrilldownModule,
  wnba: wnbaDrilldownModule,
};

export function getDrilldownSportModule(sport: DrilldownSport): DrilldownSportModule {
  return DRILLDOWN_MODULES[sport];
}
