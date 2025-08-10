import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs';

export const db = new Dexie('db1836');
db.version(1).stores({
  countries_state: '++id, country_id, quarter',
  base: '++id, country_id, indicator',
  caps: '++id, indicator',
  noise: '++id, indicator',
  fiscal: '++id, country_id',
  archetype: '++id, archetype',
  colonial_module: '++id, country_id, quarter',
  suggestions: '++id, country_id, quarter, indicator',
  remittance_queue: '++id, country_id, quarter_due',
  news: '++id, quarter, country_id'
});

export async function exportAll(){
  const obj = {};
  for (const table of db.tables){
    obj[table.name] = await table.toArray();
  }
  return obj;
}

export async function importAll(obj){
  await db.transaction('rw', db.tables, async ()=>{
    for (const table of db.tables){
      const name = table.name;
      await table.clear();
      if (obj[name]) await table.bulkAdd(obj[name]);
    }
  });
}
