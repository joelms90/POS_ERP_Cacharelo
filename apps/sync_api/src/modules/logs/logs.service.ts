import { Injectable, Logger } from '@nestjs/common';
import { pool } from '../../database/connection';
import { APP_LOGS_TABLE_SQL } from './app-logs.sql';
import { AppLogEntry, LOG_LEVELS, LogLevel } from './log-entry';

export interface LogQuery {
  since?: Date;
  until?: Date;
  source?: string;
  minLevel?: LogLevel;
  branchId?: string;
  fingerprint?: string;
  q?: string;
  limit?: number;
}

const RETENTION_DAYS = Number(process.env.APP_LOGS_RETENTION_DAYS) || 30;

@Injectable()
export class LogsService {
  private readonly logger = new Logger('AppLogs');
  private tableReady: Promise<void> | null = null;
  private lastPurgeAt = 0;

  /** Creates the table lazily so a deploy never depends on migration order. */
  private ensureTable(): Promise<void> {
    if (!this.tableReady) {
      this.tableReady = pool
        .query(APP_LOGS_TABLE_SQL)
        .then(() => undefined)
        .catch((err) => {
          this.tableReady = null;
          throw err;
        });
    }
    return this.tableReady;
  }

  /**
   * Persists entries. Never throws: logging must not break the caller.
   * Every entry is also echoed to stdout as structured JSON so it shows up
   * in Cloud Logging even if the DB insert fails.
   */
  async record(entries: AppLogEntry[]): Promise<number> {
    if (!entries.length) return 0;
    for (const e of entries) {
      const line = JSON.stringify({
        severity: e.level === 'fatal' ? 'CRITICAL' : e.level.toUpperCase(),
        logName: 'app_logs',
        source: e.source,
        branch: e.branchName ?? e.branchId,
        message: e.message,
        route: e.route,
        httpStatus: e.httpStatus,
        fingerprint: e.fingerprint,
      });
      if (e.level === 'error' || e.level === 'fatal') console.error(line);
      else console.log(line);
    }

    try {
      await this.ensureTable();
      const cols = [
        'source',
        'level',
        'message',
        'stack',
        'fingerprint',
        'occurred_at',
        'business_id',
        'branch_id',
        'branch_name',
        'user_id',
        'user_name',
        'user_role',
        'device_id',
        'app_version',
        'platform',
        'route',
        'http_method',
        'http_status',
        'context',
        'breadcrumbs',
        'user_agent',
      ];
      const values: unknown[] = [];
      const rows = entries.map((e, i) => {
        values.push(
          e.source,
          e.level,
          e.message,
          e.stack,
          e.fingerprint,
          e.occurredAt,
          e.businessId,
          e.branchId,
          e.branchName,
          e.userId,
          e.userName,
          e.userRole,
          e.deviceId,
          e.appVersion,
          e.platform,
          e.route,
          e.httpMethod,
          e.httpStatus,
          e.context ? JSON.stringify(e.context) : null,
          e.breadcrumbs ? JSON.stringify(e.breadcrumbs) : null,
          e.userAgent,
        );
        const base = i * cols.length;
        return `(${cols.map((_, j) => `$${base + j + 1}`).join(', ')})`;
      });
      await pool.query(
        `INSERT INTO app_logs (${cols.join(', ')}) VALUES ${rows.join(', ')}`,
        values,
      );
      void this.purgeOldIfDue();
      return entries.length;
    } catch (err) {
      this.logger.error(
        `Failed to persist ${entries.length} log entries: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  private async purgeOldIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPurgeAt < 3600_000) return;
    this.lastPurgeAt = now;
    try {
      await pool.query(
        `DELETE FROM app_logs WHERE occurred_at < now() - ($1 || ' days')::interval`,
        [String(RETENTION_DAYS)],
      );
    } catch (err) {
      this.logger.warn(`Log retention purge failed: ${(err as Error).message}`);
    }
  }

  private buildWhere(query: LogQuery): { where: string; values: unknown[] } {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      clauses.push(clause.replace('?', `$${values.length}`));
    };
    if (query.since) add('l.occurred_at >= ?', query.since);
    if (query.until) add('l.occurred_at < ?', query.until);
    if (query.source) add('l.source = ?', query.source);
    if (query.branchId) add('l.branch_id = ?', query.branchId);
    if (query.fingerprint) add('l.fingerprint = ?', query.fingerprint);
    if (query.q)
      add(
        `(l.message ILIKE ? OR l.route ILIKE $${values.length + 1})`,
        `%${query.q}%`,
      );
    if (query.minLevel) {
      const allowed = LOG_LEVELS.slice(LOG_LEVELS.indexOf(query.minLevel));
      add('l.level = ANY(?)', allowed);
    }
    return {
      where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      values,
    };
  }

  /** [start, end) of a calendar day in the given IANA timezone. */
  async dayWindow(
    date: string,
    timeZone: string,
  ): Promise<{ since: Date; until: Date }> {
    const { rows } = await pool.query(
      `SELECT ($1::date)::timestamp AT TIME ZONE $2 AS since,
              ($1::date + 1)::timestamp AT TIME ZONE $2 AS until`,
      [date, timeZone],
    );
    return { since: rows[0].since, until: rows[0].until };
  }

  async search(query: LogQuery) {
    await this.ensureTable();
    const { where, values } = this.buildWhere(query);
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const { rows } = await pool.query(
      `SELECT l.id, l.occurred_at AS "occurredAt", l.source, l.level, l.message, l.fingerprint,
              l.branch_id AS "branchId", COALESCE(b.name, l.branch_name) AS "branchName",
              l.user_name AS "userName", l.user_role AS "userRole", l.device_id AS "deviceId",
              l.app_version AS "appVersion", l.platform, l.route, l.http_method AS "httpMethod",
              l.http_status AS "httpStatus", left(l.stack, 600) AS "stackPreview"
         FROM app_logs l
         LEFT JOIN branches b ON b.id::text = l.branch_id
         ${where}
        ORDER BY l.occurred_at DESC
        LIMIT ${limit}`,
      values,
    );
    return rows;
  }

  async findOne(id: string) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `SELECT l.*, COALESCE(b.name, l.branch_name) AS resolved_branch_name
         FROM app_logs l LEFT JOIN branches b ON b.id::text = l.branch_id
        WHERE l.id::text = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  /**
   * Groups the window's entries by fingerprint: one row per distinct issue,
   * with how often it happened, where, on which versions, and a sample id.
   */
  async summary(query: LogQuery) {
    await this.ensureTable();
    const { where, values } = this.buildWhere(query);

    const totalsP = pool.query(
      `SELECT l.source, l.level, count(*)::int AS count FROM app_logs l ${where}
        GROUP BY l.source, l.level ORDER BY count DESC`,
      values,
    );
    const branchesP = pool.query(
      `SELECT l.branch_id AS "branchId", COALESCE(max(b.name), max(l.branch_name), 'sin sucursal') AS "branchName",
              count(*)::int AS count,
              count(*) FILTER (WHERE l.level IN ('error','fatal'))::int AS errors
         FROM app_logs l LEFT JOIN branches b ON b.id::text = l.branch_id
         ${where}
        GROUP BY l.branch_id ORDER BY count DESC`,
      values,
    );
    const issuesP = pool.query(
      `SELECT l.fingerprint, l.source,
              max(l.level) FILTER (WHERE l.level IN ('fatal')) AS has_fatal,
              mode() WITHIN GROUP (ORDER BY l.level) AS level,
              count(*)::int AS count,
              min(l.occurred_at) AS "firstSeen", max(l.occurred_at) AS "lastSeen",
              (array_agg(l.message ORDER BY l.occurred_at DESC))[1] AS message,
              (array_agg(l.route ORDER BY l.occurred_at DESC))[1] AS route,
              (array_agg(l.http_status ORDER BY l.occurred_at DESC))[1] AS "httpStatus",
              (array_agg(l.id ORDER BY l.occurred_at DESC))[1] AS "sampleId",
              (array_agg(left(l.stack, 800) ORDER BY l.occurred_at DESC))[1] AS "sampleStack",
              array_remove(array_agg(DISTINCT COALESCE(b.name, l.branch_name)), NULL) AS branches,
              array_remove(array_agg(DISTINCT l.app_version), NULL) AS "appVersions",
              array_remove(array_agg(DISTINCT l.user_name), NULL) AS users,
              count(DISTINCT l.device_id)::int AS devices
         FROM app_logs l LEFT JOIN branches b ON b.id::text = l.branch_id
         ${where}
        GROUP BY l.fingerprint, l.source
        ORDER BY count DESC
        LIMIT 50`,
      values,
    );
    const [totals, branches, issues] = await Promise.all([
      totalsP,
      branchesP,
      issuesP,
    ]);
    return {
      window: { since: query.since ?? null, until: query.until ?? null },
      totals: totals.rows,
      branches: branches.rows,
      issues: issues.rows.map(({ has_fatal, ...row }) => ({
        ...row,
        level: has_fatal ? 'fatal' : row.level,
      })),
    };
  }
}
