create index if not exists idx_bpsl_player_window
  on public.basketball_player_shot_locations
  (sport, player_id, season, season_type, game_date desc, game_id);

create index if not exists idx_bpsl_player_game_period
  on public.basketball_player_shot_locations
  (sport, player_id, game_id, period);

create or replace function public.get_basketball_shot_locations(
  p_sport text,
  p_player_id bigint,
  p_season text default null,
  p_season_type text default null,
  p_last_n_games integer default null,
  p_game_id text default null,
  p_period integer default null,
  p_half integer default null,
  p_made_filter text default 'all',
  p_limit integer default 750
)
returns jsonb
language sql
stable
as $function$
with params as (
  select
    lower(nullif(trim(p_sport), '')) as sport,
    nullif(trim(p_season), '') as season,
    nullif(trim(p_season_type), '') as season_type,
    case when p_last_n_games is not null then greatest(1, least(p_last_n_games, 82)) end as last_n_games,
    nullif(trim(p_game_id), '') as game_id,
    case when p_period is not null then greatest(1, p_period) end as period,
    case when p_half in (1, 2) then p_half end as half,
    case
      when lower(coalesce(p_made_filter, 'all')) in ('made', 'missed') then lower(p_made_filter)
      else 'all'
    end as made_filter,
    greatest(1, least(coalesce(p_limit, 750), 2000)) as row_limit
),
candidate_games as (
  select
    b.game_id,
    max(b.game_date) as game_date
  from public.basketball_player_shot_locations b
  cross join params p
  where b.sport = p.sport
    and b.player_id = p_player_id
    and (p.season is null or b.season = p.season)
    and (p.season_type is null or b.season_type = p.season_type)
    and (p.game_id is null or b.game_id = p.game_id)
  group by b.game_id
  order by max(b.game_date) desc, b.game_id desc
  limit (
    select case
      when game_id is null and last_n_games is not null then last_n_games
      else null
    end
    from params
  )
),
filtered_shots as (
  select b.*
  from public.basketball_player_shot_locations b
  cross join params p
  where b.sport = p.sport
    and b.player_id = p_player_id
    and exists (
      select 1
      from candidate_games g
      where g.game_id = b.game_id
    )
    and (p.period is null or b.period = p.period)
    and (
      p.half is null
      or (p.half = 1 and b.period in (1, 2))
      or (p.half = 2 and b.period in (3, 4))
    )
    and (
      p.made_filter = 'all'
      or (p.made_filter = 'made' and b.shot_made is true)
      or (p.made_filter = 'missed' and b.shot_made is false)
    )
),
limited_shots as (
  select *
  from filtered_shots
  order by game_date desc, game_id desc, period desc, game_event_id desc
  limit (select row_limit from params)
),
sequenced_shots as (
  select
    row_number() over (
      order by game_date asc, game_id asc, period asc, minutes_remaining desc, seconds_remaining desc, game_event_id asc
    ) as sequence,
    b.*
  from limited_shots b
),
shot_payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'sequence', sequence,
        'sport', sport,
        'season', season,
        'season_type', season_type,
        'game_id', game_id,
        'game_event_id', game_event_id,
        'game_date', game_date,
        'player_id', player_id,
        'player_name', player_name,
        'team_id', team_id,
        'team_name', team_name,
        'opponent_team_id', opponent_team_id,
        'period', period,
        'clock', jsonb_build_object(
          'minutes', minutes_remaining,
          'seconds', seconds_remaining,
          'display', concat(coalesce(minutes_remaining, 0), ':', lpad(coalesce(seconds_remaining, 0)::text, 2, '0'))
        ),
        'event_type', event_type,
        'action_type', action_type,
        'shot_type', shot_type,
        'shot_zone_basic', shot_zone_basic,
        'shot_zone_area', shot_zone_area,
        'shot_zone_range', shot_zone_range,
        'shot_distance', shot_distance,
        'loc_x', loc_x,
        'loc_y', loc_y,
        'shot_attempted', shot_attempted,
        'shot_made', shot_made,
        'htm', htm,
        'vtm', vtm
      )
      order by sequence
    ),
    '[]'::jsonb
  ) as shots
  from sequenced_shots
),
zone_summary as (
  select coalesce(jsonb_agg(zone_row order by (zone_row->>'fga')::int desc), '[]'::jsonb) as zones
  from (
    select jsonb_build_object(
      'zone', coalesce(shot_zone_basic, 'Unknown'),
      'fga', count(*),
      'fgm', count(*) filter (where shot_made is true),
      'fg_pct', round((count(*) filter (where shot_made is true))::numeric / nullif(count(*), 0), 3),
      'points', sum(case when shot_made is true then case when shot_type = '3PT Field Goal' then 3 else 2 end else 0 end),
      'pct_of_attempts', round(count(*)::numeric * 100 / nullif((select count(*) from sequenced_shots), 0), 1)
    ) as zone_row
    from sequenced_shots
    group by coalesce(shot_zone_basic, 'Unknown')
  ) z
),
range_summary as (
  select coalesce(jsonb_agg(range_row order by (range_row->>'fga')::int desc), '[]'::jsonb) as ranges
  from (
    select jsonb_build_object(
      'range', coalesce(shot_zone_range, 'Unknown'),
      'fga', count(*),
      'fgm', count(*) filter (where shot_made is true),
      'fg_pct', round((count(*) filter (where shot_made is true))::numeric / nullif(count(*), 0), 3),
      'points', sum(case when shot_made is true then case when shot_type = '3PT Field Goal' then 3 else 2 end else 0 end)
    ) as range_row
    from sequenced_shots
    group by coalesce(shot_zone_range, 'Unknown')
  ) r
),
game_summary as (
  select coalesce(jsonb_agg(game_row order by game_row->>'game_date', game_row->>'game_id'), '[]'::jsonb) as games
  from (
    select jsonb_build_object(
      'game_id', game_id,
      'game_date', max(game_date),
      'team_id', max(team_id),
      'opponent_team_id', max(opponent_team_id),
      'fga', count(*),
      'fgm', count(*) filter (where shot_made is true),
      'fg_pct', round((count(*) filter (where shot_made is true))::numeric / nullif(count(*), 0), 3),
      'points', sum(case when shot_made is true then case when shot_type = '3PT Field Goal' then 3 else 2 end else 0 end)
    ) as game_row
    from sequenced_shots
    group by game_id
  ) g
),
player_context as (
  select
    max(player_name) as player_name,
    max(team_id) as team_id,
    max(team_name) as team_name
  from sequenced_shots
),
totals as (
  select
    count(*) as shots_returned,
    count(distinct game_id) as games_returned,
    min(game_date) as date_from,
    max(game_date) as date_to,
    count(*) filter (where shot_made is true) as fgm,
    count(*) as fga,
    sum(case when shot_made is true then case when shot_type = '3PT Field Goal' then 3 else 2 end else 0 end) as points
  from sequenced_shots
)
select jsonb_build_object(
  'player', jsonb_build_object(
    'id', p_player_id,
    'name', player_context.player_name,
    'team_id', player_context.team_id,
    'team_name', player_context.team_name
  ),
  'filters', jsonb_build_object(
    'sport', params.sport,
    'season', params.season,
    'season_type', params.season_type,
    'last_n_games', params.last_n_games,
    'game_id', params.game_id,
    'period', params.period,
    'half', params.half,
    'made_filter', params.made_filter,
    'limit', params.row_limit,
    'date_from', totals.date_from,
    'date_to', totals.date_to,
    'games_returned', totals.games_returned,
    'shots_returned', totals.shots_returned
  ),
  'summary', jsonb_build_object(
    'fga', totals.fga,
    'fgm', totals.fgm,
    'fg_pct', round(totals.fgm::numeric / nullif(totals.fga, 0), 3),
    'points', coalesce(totals.points, 0)
  ),
  'shots', shot_payload.shots,
  'zone_summary', zone_summary.zones,
  'range_summary', range_summary.ranges,
  'game_summary', game_summary.games
)
from params
cross join player_context
cross join totals
cross join shot_payload
cross join zone_summary
cross join range_summary
cross join game_summary;
$function$;
