/**
 * ============================================================================
 * MODULE: server/couchdbClient.ts
 * Real Apache CouchDB 3.x HTTP REST API Client
 * Connects to Dockerized CouchDB (default: http://admin:adminpw@localhost:5984)
 * Handles:
 *   - Database provisioning (`PUT /{db}`)
 *   - Mango Rich Query index creation (`POST /{db}/_index`)
 *   - MVCC `_rev`-aware document upserts (`PUT /{db}/{id}`)
 *   - Selector queries (`POST /{db}/_find`)
 * ============================================================================
 */

export interface CouchDBConfig {
  url: string;
  worldStateDb: string;
  blocksDb: string;
}

export interface CouchStatus {
  connected: boolean;
  url: string;
  version?: string;
  worldStateDb: string;
  blocksDb: string;
  error?: string;
}

export class CouchDBClient {
  private readonly baseUrl: string;
  private readonly authHeader?: string;
  public readonly worldStateDb: string;
  public readonly blocksDb: string;

  constructor(config?: Partial<CouchDBConfig>) {
    const rawUrl = config?.url || process.env.COUCHDB_URL || 'http://admin:adminpw@127.0.0.1:5984';
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) {
      const creds = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
      this.authHeader = `Basic ${Buffer.from(creds, 'utf8').toString('base64')}`;
      parsed.username = '';
      parsed.password = '';
    }
    this.baseUrl = parsed.toString().replace(/\/$/, '');
    this.worldStateDb = config?.worldStateDb || process.env.COUCHDB_WORLDSTATE_DB || 'pharma_ke_worldstate';
    this.blocksDb = config?.blocksDb || process.env.COUCHDB_BLOCKS_DB || 'pharma_ke_blocks';
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { timeoutMs?: number }
  ): Promise<{ ok: boolean; status: number; data: T | null }> {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.authHeader) {
      headers.set('Authorization', this.authHeader);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 1800);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as T) : null;
      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async ping(): Promise<CouchStatus> {
    try {
      const res = await this.request<{ couchdb?: string; version?: string }>('/');
      if (!res.ok) {
        return {
          connected: false,
          url: this.baseUrl,
          worldStateDb: this.worldStateDb,
          blocksDb: this.blocksDb,
          error: `HTTP ${res.status}`,
        };
      }
      return {
        connected: true,
        url: this.baseUrl,
        version: res.data?.version || '3.x',
        worldStateDb: this.worldStateDb,
        blocksDb: this.blocksDb,
      };
    } catch (err) {
      return {
        connected: false,
        url: this.baseUrl,
        worldStateDb: this.worldStateDb,
        blocksDb: this.blocksDb,
        error: err instanceof Error ? err.message : 'Unreachable',
      };
    }
  }

  async ensureDatabases(): Promise<boolean> {
    try {
      for (const db of [this.worldStateDb, this.blocksDb]) {
        const head = await this.request(`/${db}`);
        if (head.status === 404) {
          await this.request(`/${db}`, { method: 'PUT' });
        }
      }
      // Ensure Mango index on status & holder for CouchDB rich queries
      await this.request(`/${this.worldStateDb}/_index`, {
        method: 'POST',
        body: JSON.stringify({
          index: { fields: ['status', 'currentHolderOrgId'] },
          name: 'idx-batch-status-holder',
          type: 'json',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getDoc<T extends Record<string, unknown>>(db: string, id: string): Promise<T | null> {
    const res = await this.request<T>(`/${db}/${encodeURIComponent(id)}`);
    if (!res.ok || !res.data) return null;
    return res.data;
  }

  async upsertDoc<T extends Record<string, unknown>>(
    db: string,
    id: string,
    doc: T
  ): Promise<{ ok: boolean; rev?: string }> {
    const existing = await this.getDoc<T & { _rev?: string }>(db, id);
    const payload = existing?._rev ? { ...doc, _rev: existing._rev } : doc;
    const res = await this.request<{ ok: boolean; rev?: string }>(
      `/${db}/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
    return { ok: res.ok, rev: res.data?.rev };
  }

  async queryWorldState(selector: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    const res = await this.request<{ docs?: Array<Record<string, unknown>> }>(
      `/${this.worldStateDb}/_find`,
      {
        method: 'POST',
        body: JSON.stringify({ selector, limit: 200 }),
      }
    );
    return res.data?.docs || [];
  }

  async getAllWorldState(): Promise<Array<Record<string, unknown>>> {
    const res = await this.request<{
      rows?: Array<{ id: string; doc?: Record<string, unknown> }>;
    }>(`/${this.worldStateDb}/_all_docs?include_docs=true`);
    return (res.data?.rows || [])
      .filter((r) => !r.id.startsWith('_design/') && r.doc)
      .map((r) => r.doc as Record<string, unknown>);
  }
}
