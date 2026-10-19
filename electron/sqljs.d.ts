declare module 'sql.js' {
  export type SqlValue = string | number | null | Uint8Array
  export type ParamsObject = Record<string, SqlValue>
  export type ParamsCallback = (obj: ParamsObject) => void
  export type BindParams = SqlValue[] | ParamsObject | null

  export interface QueryExecResult {
    columns: string[]
    values: SqlValue[][]
  }

  export interface Statement {
    step(): boolean
    getAsObject(params?: BindParams): ParamsObject
    free(): boolean
    bind(values?: BindParams): boolean
  }

  export interface Database {
    run(sql: string, params?: BindParams): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
