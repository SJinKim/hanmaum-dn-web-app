import type { Page, Route } from '@playwright/test';

/**
 * Synthetic Keycloak and API for the 장기결석자 flow (#277), installed per page with
 * `page.route`. Nothing leaves the browser: the dev server's proxy is never reached,
 * no real account or person is involved, and the people are placeholders only.
 */

const KEYCLOAK = 'http://localhost:8091/realms/hanmaum/protocol/openid-connect';
const BASE = '/api/v1/attendance/long-absences';

export interface Row {
  memberPublicId: string;
  fullName: string;
  discriminator: string | null;
  group: { publicId: string; name: string; division: string | null } | null;
  lastSundayDate: string;
  absentSince: string;
  absenceDays: number;
  absenceMonths: number;
  postAssignmentAttendance: null;
  contacted: boolean;
  contactedBy: string | null;
  contactedByMember: { publicId: string; fullName: string } | null;
  contactedAt: string | null;
  memo: string | null;
  version: number;
}

function row(id: number, fullName: string, months: number, extra: Partial<Row> = {}): Row {
  return {
    memberPublicId: `00000000-0000-4000-8000-00000000000${id}`,
    fullName,
    discriminator: null,
    group: { publicId: `00000000-0000-4000-8000-0000000000a${id}`, name: `다니엘 ${id}순`, division: '다니엘' },
    lastSundayDate: '2026-01-04',
    absentSince: '2026-01-05',
    absenceDays: months * 30,
    absenceMonths: months,
    postAssignmentAttendance: null,
    contacted: false,
    contactedBy: null,
    contactedByMember: null,
    contactedAt: null,
    memo: null,
    version: 0,
    ...extra,
  };
}

export function people(): Row[] {
  return [
    row(1, 'John Doe', 14),
    row(2, 'Max Mustermann', 7, {
      contacted: true,
      contactedBy: 'subject-tester',
      contactedByMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: '홍길동' },
      contactedAt: '2026-10-20T09:30:00Z',
      memo: '직장 때문에 이사',
      version: 2,
    }),
    row(3, '홍길동', 3),
  ];
}

export interface Backend {
  rows: Row[];
  /** Every PUT body, in order. */
  writes: { path: string; body: Record<string, unknown> }[];
  /** GET paths under /api, in order. */
  reads: string[];
  /** Status the next write answers with instead of saving, e.g. 409. */
  failNextWrite: number | null;
  summaryStatus: number;
}

function token(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(payload)}.`;
}

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
}

/** Logs in as a synthetic user with the given realm roles — no form, no password. */
export async function fakeKeycloak(page: Page, roles: string[]): Promise<void> {
  let nonce = '';
  await page.route(`${KEYCLOAK}/auth?**`, route => {
    const url = new URL(route.request().url());
    nonce = url.searchParams.get('nonce') ?? '';
    const back = `${url.searchParams.get('redirect_uri')}#state=${url.searchParams.get('state')}&session_state=s&code=c`;
    return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(back)})</script>` });
  });
  await page.route(`${KEYCLOAK}/token`, route => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { iat: now, exp: now + 3600, sub: 'subject-tester', preferred_username: 'tester', nonce };
    return json(
      route,
      200,
      {
        access_token: token({ ...claims, realm_access: { roles } }),
        id_token: token(claims),
        refresh_token: token(claims),
        token_type: 'Bearer',
        expires_in: 3600,
      },
      {
        'access-control-allow-origin': route.request().headers()['origin'] ?? '',
        'access-control-allow-credentials': 'true',
      },
    );
  });
}

/** The four long-absence operations over an in-memory list; every other API call fails. */
export async function fakeApi(page: Page, rows: Row[] = people()): Promise<Backend> {
  const backend: Backend = { rows, writes: [], reads: [], failNextWrite: null, summaryStatus: 200 };

  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') backend.reads.push(path);

    if (request.method() === 'GET' && path === BASE) {
      return json(route, 200, { success: true, message: null, data: backend.rows });
    }
    if (request.method() === 'GET' && path === `${BASE}/summary`) {
      if (backend.summaryStatus !== 200) return json(route, backend.summaryStatus, { status: backend.summaryStatus });
      const open = backend.rows.filter(r => !r.contacted);
      return json(route, 200, {
        success: true,
        message: null,
        data: {
          asOfDate: '2026-10-31',
          totalCount: backend.rows.length,
          uncontactedCount: open.length,
          atLeastSixMonthsCount: open.filter(r => r.absenceMonths >= 6).length,
        },
      });
    }
    const write = path.match(new RegExp(`^${BASE}/([^/]+)/(contact-status|memo)$`));
    if (request.method() === 'PUT' && write) {
      const body = request.postDataJSON() as Record<string, unknown>;
      backend.writes.push({ path, body });
      const index = backend.rows.findIndex(r => r.memberPublicId === write[1]);
      if (backend.failNextWrite) {
        const status = backend.failNextWrite;
        backend.failNextWrite = null;
        if (status === 409 && index >= 0) {
          // A new phase meanwhile: the person came back and is absent again.
          backend.rows[index] = { ...backend.rows[index], lastSundayDate: '2026-02-01', memo: null, contacted: false, version: 0 };
        }
        return json(route, status, { status, code: status === 409 ? 'LONG_ABSENCE_NOT_CURRENT' : undefined });
      }
      const current = backend.rows[index];
      let next: Row = { ...current, version: current.version + 1 };
      if (write[2] === 'memo') {
        const memo = body['memo'] as string | null;
        next = { ...next, memo: memo && memo.trim() ? memo : null };
      } else {
        const contacted = body['contacted'] as boolean;
        next = contacted
          ? { ...next, contacted, contactedBy: 'subject-tester', contactedByMember: null, contactedAt: '2026-10-31T10:00:00Z' }
          : { ...next, contacted, contactedBy: null, contactedByMember: null, contactedAt: null };
        const update = body['memoUpdate'] as { value: string | null } | undefined;
        if (update) next = { ...next, memo: update.value && update.value.trim() ? update.value : null };
      }
      backend.rows[index] = next;
      return json(route, 200, { success: true, message: null, data: next });
    }
    return json(route, 503, { status: 503 });
  });

  return backend;
}
