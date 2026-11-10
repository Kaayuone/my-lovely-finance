declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;

  export interface Statement {
    step(): boolean;
    getAsObject<T>(): T;
    free(): boolean;
  }

  export class Database {
    run(sql: string, values?: unknown[]): Database;
    prepare(sql: string, values?: unknown[]): Statement;
    getRowsModified(): number;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export type SqlJsConfig = {
    locateFile?: (file: string) => string;
  };

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
