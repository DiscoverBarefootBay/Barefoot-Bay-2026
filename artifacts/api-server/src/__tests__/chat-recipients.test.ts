import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import chatRouter from '../routes/chat';

describe('chat recipient list', () => {
  let server: Server;
  let origin: string;
  let adminId: number;
  let userId: number;

  before(async () => {
    const rows = await db.execute(sql`SELECT id, role FROM users WHERE role IN ('admin', 'registered') ORDER BY id`);
    const admin = rows.rows.find(row => row.role === 'admin');
    const member = rows.rows.find(row => row.role === 'registered');
    assert.ok(admin && member, 'need one admin and one regular user');
    adminId = Number(admin.id);
    userId = Number(member.id);

    const app = express();
    app.use((req: any, _res, next) => {
      req.isAuthenticated = () => req.headers['x-test-user'] !== 'none';
      if (req.isAuthenticated()) {
        req.user = { id: req.headers['x-test-user'] === 'admin' ? adminId : userId, role: req.headers['x-test-user'] === 'admin' ? 'admin' : 'registered' };
      }
      next();
    });
    app.use('/api/chat', chatRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    origin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('returns searchable identities without changing recipient IDs or group access', async () => {
    const unauthenticated = await fetch(`${origin}/api/chat/recipients`, { headers: { 'x-test-user': 'none' } });
    assert.equal(unauthenticated.status, 401);

    const adminResponse = await fetch(`${origin}/api/chat/recipients`, { headers: { 'x-test-user': 'admin' } });
    assert.equal(adminResponse.status, 200);
    const adminRecipients: any[] = await adminResponse.json();
    assert.deepEqual(adminRecipients.slice(0, 4).map(r => r.id), ['all', 'admin', 'registered', 'badge_holders']);
    assert.equal(adminRecipients.some(r => r.id === String(adminId)), false);
    const adminPerson = adminRecipients.find(r => r.id === String(userId));
    assert.ok(adminPerson);
    assert.equal(typeof adminPerson.username, 'string');
    assert.deepEqual(Object.keys(adminPerson).sort(), ['fullName', 'id', 'name', 'username']);
    assert.match(adminPerson.name, /\([^)]+\)$/);

    const memberResponse = await fetch(`${origin}/api/chat/recipients`, { headers: { 'x-test-user': 'member' } });
    assert.equal(memberResponse.status, 200);
    const memberRecipients: any[] = await memberResponse.json();
    assert.equal(memberRecipients.some(r => r.id === String(userId)), false);
    assert.ok(memberRecipients.every(r => /^\d+$/.test(r.id)));
    assert.deepEqual(Object.keys(memberRecipients[0]).sort(), ['fullName', 'id', 'name', 'username']);
  });
});