import dotenv from 'dotenv';
import pg ,{ QueryResult }  from 'pg';
import { Event, eventMapper, Regi, RegisMapper } from '../routes/types.js'
import { readFile } from 'fs/promises';
import { DbRegisToRegis, DbRegiToRegi } from './Registrations.js';
import { findById } from './Users.js';

const SCHEMA_FILE = './sql/schema.sql';
const DROP_SCHEMA_FILE = './sql/drop.sql';

dotenv.config({ path: '.env' });

const { DATABASE_URL: connectionString } = process.env;

const pool = new pg.Pool({ connectionString })

export async function createSchema(schemaFile = SCHEMA_FILE) {
  const data = await readFile(schemaFile);
  return query(data.toString('utf-8'),[]);
}

export async function dropSchema(dropFile = DROP_SCHEMA_FILE) {
  const data = await readFile(dropFile);
  return query(data.toString('utf-8'),[]);
}

pool.on('error', (err: Error) => {
    console.error('Villa í tengingu við gagnagrunn, forrit hættir', err);
    process.exit(-1);
});

//type QueryInput = string | number | null;

export async function query(
  q: string, 
  values: any | Array<unknown> = []
) {

  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    console.error('unable to get client from pool', e);
    return null;
  }

  try {
    const result = await client.query(q, values);
    return result;
  } catch (e) {
    return null;
  } finally {
    client.release();
  }
}

export async function getEvents(): Promise<Array<Event>> {
  const result = await query('SELECT * FROM events');

  if (!result) {
    return [];
  }
  
  const events = result.rows.map(eventMapper).filter((d): d is Event => d !== null).map((d) => {
    
    return d;
  });
  
  return events;
}
 
export async function getEventBySlug(
  slug: string,
): Promise<Event | null> {
  const result = await query('SELECT * FROM events WHERE slug = $1', [ 
    slug,
  ]);

  if (!result) {
    return null;
  }

  const event = eventMapper(result.rows[0]);
  
  return event;
}
export async function getRegistrations(event:number):Promise<Array<Regi>|null>{
  const result = await query('select * from registrations where event=$1;',[event]);
  if(!result){
    return null
  }
  const regis = DbRegisToRegis(result)
  return regis
}

export async function removeRegistration(event:number,username:string):Promise<boolean>{
  const result = await query(`delete from registrations
  where event =$1 and username = $2 returning 1;`,[event,username]);
  if(!result||result.rowCount===0){
    return false
  }return true

}

export async function deleteEventBySlug(slug: string): Promise<boolean> {
  const id = await query('select id from events where slug = $1;',[slug]);
  if(!id||id.rowCount==0){
    return false
  }
  await query('delete from registration where event= $1',[id.rows[0].id]);
  const result = await query('DELETE FROM events WHERE slug = $1;', [slug]);

  if (!result) {
    return false;
  }

  return result.rowCount === 1;
}

export async function insertEvent(
  event: Omit<Event,'id'>
): Promise<Event | null> {
  const { name, slug, description } = event;
  const result = await query(
    'INSERT INTO events (name, slug, description) VALUES ($1, $2, $3) RETURNING id, name, slug, description, created, updated',
    [name, slug, description]
  );
  const mapped = eventMapper(result?.rows[0]);

  return mapped;
}

export async function conditionalUpdate(
  table: string,
  id: number,
  fields: Array<string | null>,
  values: Array<string | number | null>,
) {
  const filteredFields = fields.filter((i) => typeof i === 'string');
  const filteredValues = values.filter(
    (i): i is string | number => typeof i === 'string' || typeof i === 'number',
  );

  if (filteredFields.length === 0) {
    return false;
  }

  if (filteredFields.length !== filteredValues.length) {
    throw new Error('fields and values must be of equal length');
  }

  // id is field = 1
  const updates = filteredFields.map((field, i) => `${field} = $${i + 2}`);

  const q = `
    UPDATE ${table}
      SET ${updates.join(', ')}
    WHERE
      id = $1
    RETURNING *
    `;

  const queryValues: Array<string | number> = (
    [id] as Array<string | number>
  ).concat(filteredValues);
  const result = await query(q, queryValues);

  return result;
}


export async function end() {
  await pool.end();
}