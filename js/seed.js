import {db} from './db.js';

export async function ensureSeed(){
  const cnt = await db.countries_state.count();
  if (cnt>0) return;

  await db.countries_state.bulkAdd([
    {country_id:'UK', country_name:'United Kingdom', quarter:'1836Q1',
     population_m:16.5, gdp_agri:60.0, gdp_ind:90.0, gdp_serv:110.0,
     army_k:110, morale:68, training:64, legitimacy:75, influence:90,
     revenue:0.0, expense:0.0, debt:250.0, credit:'A',
     port_level_home:3, logistics_delay_q:1},
    {country_id:'FR', country_name:'France', quarter:'1836Q1',
     population_m:34.0, gdp_agri:120.0, gdp_ind:80.0, gdp_serv:95.0,
     army_k:300, morale:66, training:62, legitimacy:70, influence:85,
     revenue:0.0, expense:0.0, debt:150.0, credit:'A',
     port_level_home:2, logistics_delay_q:1},
  ]);

  await db.base.bulkAdd([
    {country_id:'UK', indicator:'pop', base_q_growth:0.003},
    {country_id:'UK', indicator:'gdp_agri', base_q_growth:0.003},
    {country_id:'UK', indicator:'gdp_ind', base_q_growth:0.012},
    {country_id:'UK', indicator:'gdp_serv', base_q_growth:0.010},
    {country_id:'FR', indicator:'pop', base_q_growth:0.0025},
    {country_id:'FR', indicator:'gdp_agri', base_q_growth:0.004},
    {country_id:'FR', indicator:'gdp_ind', base_q_growth:0.009},
    {country_id:'FR', indicator:'gdp_serv', base_q_growth:0.007},
  ]);

  await db.caps.bulkAdd([
    {indicator:'pop', min_q_growth:-0.01, max_q_growth:0.01},
    {indicator:'gdp_agri', min_q_growth:-0.03, max_q_growth:0.03},
    {indicator:'gdp_ind', min_q_growth:-0.06, max_q_growth:0.06},
    {indicator:'gdp_serv', min_q_growth:-0.04, max_q_growth:0.04},
  ]);

  await db.noise.bulkAdd([
    {indicator:'pop', noise_amp:0.0008},
    {indicator:'gdp_agri', noise_amp:0.006},
    {indicator:'gdp_ind', noise_amp:0.010},
    {indicator:'gdp_serv', noise_amp:0.006},
  ]);

  await db.fiscal.bulkAdd([
    {country_id:'UK', revenue_rate:0.12, expense_base:20.0, military_per_10k:1.2, interest_A:0.011, interest_B:0.016, interest_C:0.024},
    {country_id:'FR', revenue_rate:0.11, expense_base:18.0, military_per_10k:1.1, interest_A:0.012, interest_B:0.017, interest_C:0.025},
  ]);

  await db.archetype.bulkAdd([
    {archetype:'British_trade', alpha_industrial:0.25, alpha_service:0.35, tau_ind:0.12, tau_serv:0.10,
     admin_cost_base:10.0, unrest_to_cost:0.06, garrison_cost_per_level:1.2, trade_pref_floor:-0.10, trade_pref_ceil:0.30},
    {archetype:'French_admin', alpha_industrial:0.20, alpha_service:0.25, tau_ind:0.11, tau_serv:0.095,
     admin_cost_base:11.0, unrest_to_cost:0.08, garrison_cost_per_level:1.1, trade_pref_floor:-0.10, trade_pref_ceil:0.25},
  ]);

  await db.colonial_module.bulkAdd([
    {country_id:'UK', quarter:'1836Q1', archetype:'British_trade', colonial_gdp:80.0, extraction_share:0.55, admin_cost:12.0,
     trade_preference:0.20, unrest:35, ports_level_colonial:3, sea_lanes_level:3, garrison_level:2, remittance_lag_q:1},
    {country_id:'FR', quarter:'1836Q1', archetype:'French_admin', colonial_gdp:30.0, extraction_share:0.40, admin_cost:10.0,
     trade_preference:0.10, unrest:30, ports_level_colonial:2, sea_lanes_level:2, garrison_level:2, remittance_lag_q:1},
  ]);
}
