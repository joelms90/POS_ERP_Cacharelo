import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  LOG_LEVELS,
  LOG_SOURCES,
  LogLevel,
  LIMITS,
  sanitizeClientEntry,
} from './log-entry';
import { LogQuery, LogsService } from './logs.service';

const DEFAULT_TZ = process.env.APP_LOGS_TIMEZONE || 'America/Mexico_City';

/** Simple per-IP budget so a buggy client loop cannot flood the table. */
class IntakeBudget {
  private readonly windowMs = 10 * 60_000;
  private readonly maxEntries = 600;
  private buckets = new Map<string, { start: number; used: number }>();

  take(key: string, n: number): number {
    const now = Date.now();
    if (this.buckets.size > 5000) this.buckets.clear();
    let b = this.buckets.get(key);
    if (!b || now - b.start > this.windowMs) {
      b = { start: now, used: 0 };
      this.buckets.set(key, b);
    }
    const granted = Math.max(0, Math.min(n, this.maxEntries - b.used));
    b.used += granted;
    return granted;
  }
}

@Controller()
export class LogsController {
  private readonly budget = new IntakeBudget();

  constructor(private readonly logs: LogsService) {}

  /**
   * Public intake used by the POS app and the admin web. Unauthenticated on
   * purpose: crashes often happen before login or after a token expires.
   * Body: { entries: [...] } or a single entry object.
   */
  @Post('logs')
  @HttpCode(202)
  async ingest(@Body() body: any, @Req() req: any) {
    const rawEntries: unknown[] = Array.isArray(body?.entries)
      ? body.entries
      : body
        ? [body]
        : [];
    const ip = String(req.headers?.['x-forwarded-for'] ?? req.ip ?? 'unknown')
      .split(',')[0]
      .trim();
    const granted = this.budget.take(
      ip,
      Math.min(rawEntries.length, LIMITS.entriesPerRequest),
    );
    const userAgent = req.headers?.['user-agent'] ?? null;
    const entries = rawEntries
      .slice(0, granted)
      .map((raw) => sanitizeClientEntry(raw, { userAgent }))
      .filter(
        (e): e is NonNullable<typeof e> =>
          e !== null && e.source !== 'sync_api',
      );
    const stored = await this.logs.record(entries);
    return { accepted: stored, dropped: rawEntries.length - stored };
  }

  @Get('admin/logs')
  @UseGuards(AdminGuard)
  async search(@Query() q: Record<string, string>) {
    return this.logs.search(await this.parseQuery(q));
  }

  /**
   * Daily digest grouped by issue. Defaults to "today" in Mexico City time.
   * ?date=YYYY-MM-DD | ?hours=N, plus optional source/branchId/minLevel/q.
   */
  @Get('admin/logs/summary')
  @UseGuards(AdminGuard)
  async summary(@Query() q: Record<string, string>) {
    return this.logs.summary(
      await this.parseQuery(q, { defaultToToday: true }),
    );
  }

  @Get('admin/logs/:id')
  @UseGuards(AdminGuard)
  async findOne(@Param('id') id: string) {
    const row = await this.logs.findOne(id);
    if (!row) throw new NotFoundException('Log no encontrado');
    return row;
  }

  private async parseQuery(
    q: Record<string, string>,
    opts: { defaultToToday?: boolean } = {},
  ): Promise<LogQuery> {
    const query: LogQuery = {};
    const tz = q.tz || DEFAULT_TZ;

    if (q.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date))
        throw new BadRequestException('date debe ser YYYY-MM-DD');
      Object.assign(query, await this.logs.dayWindow(q.date, tz));
    } else if (q.hours) {
      const hours = Number(q.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 31)
        throw new BadRequestException('hours inválido');
      query.since = new Date(Date.now() - hours * 3600_000);
    } else if (q.since || q.until) {
      for (const key of ['since', 'until'] as const) {
        if (!q[key]) continue;
        const d = new Date(q[key]);
        if (Number.isNaN(d.getTime()))
          throw new BadRequestException(`${key} inválido`);
        query[key] = d;
      }
    } else if (opts.defaultToToday) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
        new Date(),
      );
      Object.assign(query, await this.logs.dayWindow(today, tz));
    }

    if (q.source) {
      if (!LOG_SOURCES.includes(q.source as any))
        throw new BadRequestException(`source: ${LOG_SOURCES.join('|')}`);
      query.source = q.source;
    }
    if (q.minLevel) {
      if (!LOG_LEVELS.includes(q.minLevel as LogLevel))
        throw new BadRequestException(`minLevel: ${LOG_LEVELS.join('|')}`);
      query.minLevel = q.minLevel as LogLevel;
    }
    if (q.branchId) query.branchId = q.branchId;
    if (q.fingerprint) query.fingerprint = q.fingerprint;
    if (q.q) query.q = q.q.slice(0, 200);
    if (q.limit) query.limit = Number(q.limit) || undefined;
    return query;
  }
}
