/**
 * facebook-routes.ts — Fastify plugin for all Facebook integration endpoints.
 *
 * Routes registered under /api/v1/integrations/facebook:
 *   GET  /oauth/start                      — redirect to Meta OAuth dialog
 *   GET  /oauth/callback                   — Meta redirects back here with code
 *   GET  /webhook                          — Meta webhook verification challenge
 *   POST /webhook                          — Meta webhook lead events (raw body HMAC)
 *   GET  /pages                            — list connected pages for org
 *   POST /pages/:pageId/disconnect         — disconnect a page
 *   GET  /pages/:pageId/forms              — live form list from Graph (cache 60s)
 *   GET  /mappings                         — list FacebookFormMapping for org
 *   POST /mappings                         — create mapping (form → CustomerList)
 *   PUT  /mappings/:id                     — update mapping fields
 *   DELETE /mappings/:id                   — soft-delete mapping (enabled=false)
 *   GET  /customer-lists/:listId/sale-assignments — list assignments for a list
 *   PUT  /customer-lists/:listId/sale-assignments — upsert assignment pool
 *   POST /admin/refresh-tokens             — manual trigger token refresh for org (admin only)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../../auth/auth-middleware.js';
import { requireRole } from '../../../auth/role-middleware.js';
import { logger } from '../../../../shared/utils/logger.js';
import { prisma } from '../../../../shared/database/prisma-client.js';
import {
  verifyChallenge,
  verifySignature,
  extractLeadgenEvents,
  enqueueAll,
} from './facebook-webhook-service.js';
import {
  buildAuthUrl,
  generateState,
  verifyState,
  handleCallback,
  disconnectPage,
} from './facebook-oauth-service.js';
import { runRefreshForOrg } from './facebook-token-refresh-cron.js';

const PREFIX = '/api/v1/integrations/facebook';
const FRONTEND_FB_PATH = '/settings/channels/facebook';

export async function facebookRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /oauth/start ─────────────────────────────────────────────────────
  // Generates CSRF state and redirects to Meta OAuth dialog.
  // Auth required — we need orgId.
  app.get(
    `${PREFIX}/oauth/start`,
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.user!;
        const state = generateState(orgId);
        const authUrl = buildAuthUrl(orgId, state);
        return reply.redirect(authUrl, 302);
      } catch (err) {
        logger.error('[fb-routes] OAuth start error:', err);
        return reply.status(500).send({ error: 'Failed to initiate Facebook OAuth' });
      }
    },
  );

  // ── GET /oauth/callback ───────────────────────────────────────────────────
  // Meta redirects here. Verify state, exchange code, persist pages.
  // No auth middleware — state param carries the orgId signed with FB_APP_SECRET.
  app.get(
    `${PREFIX}/oauth/callback`,
    async (
      request: FastifyRequest<{
        Querystring: { code?: string; state?: string; error?: string; error_reason?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { code, state, error, error_reason } = request.query;
      const frontendBase = `${process.env.APP_URL ?? ''}${FRONTEND_FB_PATH}`;

      // User denied permissions
      if (error) {
        logger.warn('[fb-routes] OAuth denied: %s %s', error, error_reason);
        return reply.redirect(`${frontendBase}?status=error&reason=${encodeURIComponent(error_reason ?? error)}`, 302);
      }

      if (!code || !state) {
        return reply.redirect(`${frontendBase}?status=error&reason=missing_params`, 302);
      }

      // CSRF check
      const orgId = verifyState(state);
      if (!orgId) {
        logger.warn('[fb-routes] Invalid OAuth state received');
        return reply.redirect(`${frontendBase}?status=error&reason=invalid_state`, 302);
      }

      try {
        const { connectedPages } = await handleCallback(code, orgId);
        return reply.redirect(`${frontendBase}?status=success&pages=${connectedPages}`, 302);
      } catch (err) {
        logger.error('[fb-routes] OAuth callback error for org %s:', orgId, err);
        const reason = encodeURIComponent((err as Error).message.slice(0, 100));
        return reply.redirect(`${frontendBase}?status=error&reason=${reason}`, 302);
      }
    },
  );

  // ── GET /webhook ─────────────────────────────────────────────────────────
  // Meta webhook verification challenge — must return hub.challenge as plain text.
  // NO auth — Meta calls this directly.
  app.get(
    `${PREFIX}/webhook`,
    async (
      request: FastifyRequest<{
        Querystring: {
          'hub.mode'?: string;
          'hub.verify_token'?: string;
          'hub.challenge'?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const challenge = verifyChallenge(request.query);
      if (!challenge) {
        logger.warn('[fb-routes] Webhook challenge failed — invalid verify_token or mode');
        return reply.status(403).send('Forbidden');
      }
      return reply.type('text/plain').send(challenge);
    },
  );

  // ── POST /webhook ─────────────────────────────────────────────────────────
  // Meta webhook lead events. Must:
  //   1. Read raw body for HMAC (scoped content-type parser, buffer mode)
  //   2. Verify HMAC before any parsing
  //   3. Enqueue events and return 200 in < 500ms
  // NO auth — verified by HMAC.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 1_048_576 }, // 1 MB limit
    (req, body: Buffer, done) => {
      // Only intercept the webhook POST — other routes still use default JSON parser.
      // Fastify picks the most-specific match; we attach rawBody to request for
      // HMAC verify, then parse JSON ourselves.
      (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body;
      try {
        done(null, JSON.parse(body.toString('utf8')));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post(
    `${PREFIX}/webhook`,
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Respond fast — enqueue only, never process inline
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      const sig = request.headers['x-hub-signature-256'] as string | undefined;

      if (!rawBody) {
        logger.warn('[fb-routes] Webhook POST: missing raw body');
        return reply.status(400).send({ error: 'bad_request' });
      }

      if (!verifySignature(rawBody, sig)) {
        logger.warn('[fb-routes] Webhook POST: HMAC verification failed');
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      const events = extractLeadgenEvents(request.body);
      // Fire-and-forget enqueue — do NOT await to keep latency < 500ms
      enqueueAll(events).catch((err) =>
        logger.error('[fb-routes] Enqueue error:', err),
      );

      return reply.status(200).send({ ok: true });
    },
  );

  // ── GET /pages ────────────────────────────────────────────────────────────
  // List connected Facebook pages for the current org.
  app.get(
    `${PREFIX}/pages`,
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.user!;
        const pages = await prisma.facebookPageConnection.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            pageId: true,
            pageName: true,
            status: true,
            subscribedAt: true,
            tokenExpiresAt: true,
            lastError: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Enrich each page with last lead event time
        const enriched = await Promise.all(
          pages.map(async (p) => {
            const lastEvent = await prisma.facebookLeadEvent.findFirst({
              where: { orgId, pageId: p.pageId },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            });
            return { ...p, lastLeadAt: lastEvent?.createdAt ?? null };
          }),
        );

        return enriched;
      } catch (err) {
        logger.error('[fb-routes] GET pages error:', err);
        return reply.status(500).send({ error: 'Failed to fetch Facebook pages' });
      }
    },
  );

  // ── POST /pages/:pageId/disconnect ────────────────────────────────────────
  // Disconnect a page: wipe token, set status=revoked, call FB unsubscribe.
  // Admin+ only.
  app.post(
    `${PREFIX}/pages/:pageId/disconnect`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.user!;
        const { pageId } = request.params as { pageId: string };

        // Count active mappings before disconnect (for UI warning)
        const activeMappings = await prisma.facebookFormMapping.count({
          where: {
            orgId,
            pageConnection: { pageId },
            enabled: true,
          },
        });

        await disconnectPage(orgId, pageId);
        return { success: true, disabledMappings: activeMappings };
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('not found')) {
          return reply.status(404).send({ error: 'Page connection not found' });
        }
        logger.error('[fb-routes] Disconnect page error:', err);
        return reply.status(500).send({ error: 'Failed to disconnect page' });
      }
    },
  );

  // ── GET /pages/:pageId/forms ──────────────────────────────────────────────
  // Fetch live leadgen forms from Graph API for a connected page.
  // In-memory cache 60s to avoid hammering Graph rate limits.
  // Auth required (admin+ not needed — any authenticated user can view forms).
  const formsCache = new Map<string, { data: unknown[]; expiresAt: number }>();

  app.get<{ Params: { pageId: string } }>(
    `${PREFIX}/pages/:pageId/forms`,
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { pageId } = request.params;

        const cacheKey = `${orgId}:${pageId}`;
        const cached = formsCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return cached.data;
        }

        // Verify the connection belongs to this org
        const conn = await prisma.facebookPageConnection.findFirst({
          where: { orgId, pageId },
          select: { accessTokenEnc: true, status: true },
        });
        if (!conn) {
          return reply.status(404).send({ error: 'Page not connected to this org' });
        }
        if (conn.status !== 'connected' || !conn.accessTokenEnc) {
          return reply.status(400).send({ error: 'Page token not available — reconnect required' });
        }

        const { decrypt } = await import('../../../../shared/crypto/aes-gcm.js');
        const pageToken = decrypt(conn.accessTokenEnc);

        const GRAPH_BASE = `https://graph.facebook.com/${process.env.FB_GRAPH_API_VERSION ?? 'v23.0'}`;
        const url = `${GRAPH_BASE}/${pageId}/leadgen_forms?fields=id,name,status,created_time,leads_count&access_token=${encodeURIComponent(pageToken)}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          const body = await res.text();
          logger.warn('[fb-routes] Graph forms fetch failed %d: %s', res.status, body.slice(0, 200));
          if (res.status >= 400 && res.status < 500) {
            return reply.status(502).send({ error: 'Facebook API rejected request — token may be expired' });
          }
          return reply.status(502).send({ error: 'Facebook API error' });
        }

        const json = await res.json() as { data: unknown[] };
        const forms = json.data ?? [];

        formsCache.set(cacheKey, { data: forms, expiresAt: Date.now() + 60_000 });
        return forms;
      } catch (err) {
        logger.error('[fb-routes] GET forms error:', err);
        return reply.status(500).send({ error: 'Failed to fetch forms' });
      }
    },
  );

  // ── GET /mappings ─────────────────────────────────────────────────────────
  // List all FacebookFormMapping for current org.
  app.get(
    `${PREFIX}/mappings`,
    { preHandler: authMiddleware },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.user!;
        const mappings = await prisma.facebookFormMapping.findMany({
          where: { orgId },
          orderBy: { createdAt: 'desc' },
          include: {
            pageConnection: {
              select: { pageId: true, pageName: true, status: true },
            },
            customerList: {
              select: { id: true, name: true, iconEmoji: true },
            },
          },
        });
        return mappings;
      } catch (err) {
        logger.error('[fb-routes] GET mappings error:', err);
        return reply.status(500).send({ error: 'Failed to fetch mappings' });
      }
    },
  );

  // ── POST /mappings ────────────────────────────────────────────────────────
  // Create a new form → CustomerList mapping.
  app.post<{
    Body: { pageConnectionId: string; formId: string; formName: string; customerListId: string; fieldMap?: Record<string, string> };
  }>(
    `${PREFIX}/mappings`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { pageConnectionId, formId, formName, customerListId, fieldMap } = request.body;

        if (!pageConnectionId || !formId || !formName || !customerListId) {
          return reply.status(400).send({ error: 'pageConnectionId, formId, formName, customerListId required' });
        }

        // Verify pageConnection belongs to this org
        const conn = await prisma.facebookPageConnection.findFirst({
          where: { id: pageConnectionId, orgId },
        });
        if (!conn) {
          return reply.status(404).send({ error: 'Page connection not found' });
        }

        const mapping = await prisma.facebookFormMapping.create({
          data: {
            orgId,
            pageConnectionId,
            formId,
            formName,
            customerListId,
            fieldMap: (fieldMap ?? {}) as object,
            enabled: true,
          },
        });
        return reply.status(201).send(mapping);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Unique constraint')) {
          return reply.status(409).send({ error: 'A mapping for this form already exists' });
        }
        logger.error('[fb-routes] POST mappings error:', err);
        return reply.status(500).send({ error: 'Failed to create mapping' });
      }
    },
  );

  // ── PUT /mappings/:id ─────────────────────────────────────────────────────
  // Update an existing form mapping (customerListId, fieldMap, enabled).
  app.put<{
    Params: { id: string };
    Body: { customerListId?: string; fieldMap?: Record<string, string>; enabled?: boolean };
  }>(
    `${PREFIX}/mappings/:id`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { id } = request.params;
        const { customerListId, fieldMap, enabled } = request.body;

        const existing = await prisma.facebookFormMapping.findFirst({
          where: { id, orgId },
        });
        if (!existing) {
          return reply.status(404).send({ error: 'Mapping not found' });
        }

        const updated = await prisma.facebookFormMapping.update({
          where: { id },
          data: {
            ...(customerListId !== undefined && { customerListId }),
            ...(fieldMap !== undefined && { fieldMap: fieldMap as object }),
            ...(enabled !== undefined && { enabled }),
          },
        });
        return updated;
      } catch (err) {
        logger.error('[fb-routes] PUT mappings error:', err);
        return reply.status(500).send({ error: 'Failed to update mapping' });
      }
    },
  );

  // ── DELETE /mappings/:id ──────────────────────────────────────────────────
  // Soft-delete: set enabled=false (preserves history, stops lead processing).
  app.delete<{ Params: { id: string } }>(
    `${PREFIX}/mappings/:id`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { id } = request.params;

        const existing = await prisma.facebookFormMapping.findFirst({
          where: { id, orgId },
        });
        if (!existing) {
          return reply.status(404).send({ error: 'Mapping not found' });
        }

        await prisma.facebookFormMapping.update({
          where: { id },
          data: { enabled: false },
        });
        return { success: true };
      } catch (err) {
        logger.error('[fb-routes] DELETE mappings error:', err);
        return reply.status(500).send({ error: 'Failed to delete mapping' });
      }
    },
  );

  // ── GET /customer-lists/:listId/sale-assignments ─────────────────────────
  // List sale assignments for a customer list (join with user display info).
  app.get<{ Params: { listId: string } }>(
    `${PREFIX}/customer-lists/:listId/sale-assignments`,
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { listId } = request.params;

        // Verify list belongs to org
        const list = await prisma.customerList.findFirst({
          where: { id: listId, orgId },
          select: { id: true },
        });
        if (!list) {
          return reply.status(404).send({ error: 'Customer list not found' });
        }

        const assignments = await prisma.customerListSaleAssignment.findMany({
          where: { customerListId: listId },
          include: {
            user: { select: { id: true, fullName: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        return assignments;
      } catch (err) {
        logger.error('[fb-routes] GET sale-assignments error:', err);
        return reply.status(500).send({ error: 'Failed to fetch sale assignments' });
      }
    },
  );

  // ── PUT /customer-lists/:listId/sale-assignments ─────────────────────────
  // Upsert assignment pool: delete removed entries, upsert provided ones.
  app.put<{
    Params: { listId: string };
    Body: { assignments: Array<{ userId: string; weight?: number; enabled?: boolean }> };
  }>(
    `${PREFIX}/customer-lists/:listId/sale-assignments`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request, reply) => {
      try {
        const { orgId } = request.user!;
        const { listId } = request.params;
        const { assignments } = request.body;

        if (!Array.isArray(assignments)) {
          return reply.status(400).send({ error: 'assignments must be an array' });
        }

        // Verify list belongs to org
        const list = await prisma.customerList.findFirst({
          where: { id: listId, orgId },
          select: { id: true },
        });
        if (!list) {
          return reply.status(404).send({ error: 'Customer list not found' });
        }

        const incomingUserIds = assignments.map((a) => a.userId);

        await prisma.$transaction(async (tx) => {
          // Delete assignments not in incoming list
          await tx.customerListSaleAssignment.deleteMany({
            where: {
              customerListId: listId,
              userId: { notIn: incomingUserIds },
            },
          });

          // Upsert each provided assignment
          for (const a of assignments) {
            await tx.customerListSaleAssignment.upsert({
              where: { customerListId_userId: { customerListId: listId, userId: a.userId } },
              create: {
                customerListId: listId,
                userId: a.userId,
                weight: a.weight ?? 1,
                enabled: a.enabled ?? true,
              },
              update: {
                weight: a.weight ?? 1,
                enabled: a.enabled ?? true,
              },
            });
          }
        });

        // Return updated list
        const updated = await prisma.customerListSaleAssignment.findMany({
          where: { customerListId: listId },
          include: {
            user: { select: { id: true, fullName: true, email: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        return updated;
      } catch (err) {
        logger.error('[fb-routes] PUT sale-assignments error:', err);
        return reply.status(500).send({ error: 'Failed to update sale assignments' });
      }
    },
  );

  // ── POST /admin/refresh-tokens ────────────────────────────────────────────
  // Manual trigger: refresh tokens for all connected pages in current org.
  // Ops debugging only — requires admin+ role.
  app.post(
    `${PREFIX}/admin/refresh-tokens`,
    { preHandler: [authMiddleware, requireRole('owner', 'admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orgId } = request.user!;
        logger.info('[fb-routes] Manual token refresh triggered for org %s', orgId);
        const summary = await runRefreshForOrg(orgId);
        return summary;
      } catch (err) {
        logger.error('[fb-routes] Manual refresh-tokens error:', err);
        return reply.status(500).send({ error: 'Token refresh failed' });
      }
    },
  );
}
