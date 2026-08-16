declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): any;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: any) => Database;
  }

  export function initSqlJs(config?: any): Promise<SqlJsStatic>;

  const _default: typeof initSqlJs;
  export default _default;
}

declare module 'uuid' {
  export function v4(): string;
}
