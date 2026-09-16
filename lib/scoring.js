// This league's scoring rules, as configured in ESPN. Field names on the
// right are Sleeper's raw per-player stat keys (same shape returned by
// Sleeper's stats/projections endpoints), used to turn a raw stat line into
// fantasy points under our own rules rather than trusting a provider's own
// scoring (Sleeper ships its own pts_ppr, which is deliberately ignored).
//
// Kicking is yardage-based (no flat make bonus) with separate miss penalties
// bucketed by distance — mirrors ESPN's "distance-based" kicker scoring
// exactly as configured, not the more common flat-3/4/5 scheme.
const RULES = {
  pass_yd: 0.04,
  pass_td: 6,
  pass_int: -2,
  pass_2pt: 2,

  rush_yd: 0.1,
  rush_td: 6,
  rush_fd: 0.5,
  rush_2pt: 2,

  rec: 0.5,
  rec_yd: 0.1,
  rec_td: 6,
  rec_fd: 0.5,
  rec_2pt: 2,

  xpm: 1,
  fgm_yds: 0.1,
  fgmiss_0_39: -1,
  fgmiss_40_49: -1,
  fgmiss_50_59: -1,

  kr_td: 6,
  pr_td: 6,
  fum_rec_td: 6,
  fum_lost: -2,
  int_td: 6,
  fum_ret_td: 6,
  blk_kick_ret_td: 6,
  '2pt_ret': 2,
  safe: 1,
}

// Sleeper's raw field names vary slightly by source; this maps the common
// aliases seen in their per-player and per-week payloads onto the RULES keys
// above so either shape scores the same way.
const ALIASES = {
  pass_yd: ['pass_yd', 'py'],
  pass_td: ['pass_td', 'pass_td_lng', 'ptd'],
  pass_int: ['pass_int', 'int'],
  pass_2pt: ['pass_2pt'],
  rush_yd: ['rush_yd', 'ry'],
  rush_td: ['rush_td', 'rtd'],
  rush_fd: ['rush_fd'],
  rush_2pt: ['rush_2pt'],
  rec: ['rec'],
  rec_yd: ['rec_yd', 'rey'],
  rec_td: ['rec_td', 'retd'],
  rec_fd: ['rec_fd'],
  rec_2pt: ['rec_2pt'],
  xpm: ['xpm', 'fgm_pat'],
  fgm_yds: ['fgm_yds'],
  fgmiss_0_39: ['fgmiss_0_19', 'fgmiss_20_29', 'fgmiss_30_39'],
  fgmiss_40_49: ['fgmiss_40_49'],
  fgmiss_50_59: ['fgmiss_50_59', 'fgmiss_60p'],
  kr_td: ['kr_td'],
  pr_td: ['pr_td'],
  fum_rec_td: ['fum_rec_td'],
  fum_lost: ['fum_lost'],
  int_td: ['def_int_td', 'int_td'],
  fum_ret_td: ['fum_ret_td'],
  blk_kick_ret_td: ['blk_kick_ret_td'],
  '2pt_ret': ['def_2pt', '2pt_ret'],
  safe: ['safe'],
}

const statValue = (stats, ruleKey) => {
  const aliases = ALIASES[ruleKey] || [ruleKey]
  return aliases.reduce((sum, key) => sum + (stats?.[key] || 0), 0)
}

/** Fantasy points for one player's raw stat line, under this league's rules. */
export function scorePlayer(stats) {
  if (!stats) return 0
  return Object.entries(RULES).reduce((total, [key, pts]) => total + statValue(stats, key) * pts, 0)
}
