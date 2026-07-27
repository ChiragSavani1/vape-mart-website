import { createHash } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global { var vapeMartPool: Pool | undefined; }

export function getPool(){
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return globalThis.vapeMartPool ||= new Pool({
    connectionString:process.env.DATABASE_URL,
    max:Number(process.env.DATABASE_POOL_SIZE||10),
    idleTimeoutMillis:30_000,
    connectionTimeoutMillis:10_000,
    ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined,
  });
}

function postgresSql(sql:string){
  let position=0;
  return sql.replace(/\?/g,()=>`$${++position}`);
}

export class PostgresPreparedQuery {
  values:unknown[]=[];
  constructor(public sql:string,private client:Pool|PoolClient=getPool()){}
  bind(...values:unknown[]){this.values=values;return this;}
  async all<T extends QueryResultRow=QueryResultRow>(){
    const result=await this.client.query<T>(postgresSql(this.sql),this.values);
    return {results:result.rows,success:true,meta:{changes:result.rowCount||0}};
  }
  async first<T extends QueryResultRow=QueryResultRow>(){
    return (await this.all<T>()).results[0]??null;
  }
  async run(){
    const result=await this.client.query(postgresSql(this.sql),this.values);
    return {success:true,results:result.rows,meta:{changes:result.rowCount||0}};
  }
}

export class PostgresDatabase {
  constructor(private client:Pool|PoolClient=getPool()){}
  prepare(sql:string){return new PostgresPreparedQuery(sql,this.client);}
  async batch(statements:PostgresPreparedQuery[]){
    const client=await getPool().connect();
    try{
      await client.query("BEGIN");
      const results=[];
      for(const statement of statements){
        const query=new PostgresPreparedQuery(statement.sql,client);
        query.values=statement.values;
        results.push(await query.run());
      }
      await client.query("COMMIT");
      return results;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
}

let database:PostgresDatabase|undefined;
export async function ensureDatabase(){return database ||= new PostgresDatabase();}
export async function sha256(input:string){return createHash("sha256").update(input).digest("hex");}
