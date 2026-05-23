/**
 * Distribution engine — concurrency test.
 *
 * Creates a set of overlapping orders (mixed exclusive/shared, varying
 * priority and balance), fires many VALID leads through the REAL engine
 * concurrently, and asserts the hard invariants hold afterwards:
 *
 *   - no order's quantity_remaining went negative
 *   - no EXCLUSIVE lead has more than 1 assignment
 *   - no SHARED lead has more than 4 assignments
 *   - no lead is billed to the same order twice
 *   - totals reconcile (assignments created == balance decremented)
 *   - every lead ends ASSIGNED (>=1) or UNSOLD_POOL (0)
 *
 * Run with:  pnpm --filter @leads-portal/api test:concurrency
 * Requires a reachable DATABASE_URL with the Phase 6 migration applied.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DeliveryMode, LeadState, LeadType, OrderStatus, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { DistributionService } from '../src/distribution/distribution.service';
import { PrismaService } from '../src/prisma/prisma.service';

const MARKER = 'CCT'; // tags every row this test creates
const AGENT_EMAIL = 'cct-agent@concurrency.test';
const CLIENT_EMAIL = 'cct-client@concurrency.test';
const LEAD_COUNT = 50;

/* eslint-disable no-console */

interface OrderSpec {
  tag: string;
  mode: DeliveryMode;
  priority: number;
  balance: number;
  price: number;
}

const ORDER_SPECS: OrderSpec[] = [
  { tag: 'EXA', mode: DeliveryMode.EXCLUSIVE, priority: 100, balance: 5, price: 45 },
  { tag: 'EXB', mode: DeliveryMode.EXCLUSIVE, priority: 100, balance: 5, price: 45 },
  { tag: 'SH1', mode: DeliveryMode.SHARED, priority: 50, balance: 20, price: 18 },
  { tag: 'SH2', mode: DeliveryMode.SHARED, priority: 50, balance: 20, price: 18 },
  { tag: 'SH3', mode: DeliveryMode.SHARED, priority: 50, balance: 20, price: 18 },
  { tag: 'SH4', mode: DeliveryMode.SHARED, priority: 50, balance: 20, price: 18 },
  { tag: 'SH5', mode: DeliveryMode.SHARED, priority: 10, balance: 30, price: 18 },
];

async function cleanup(prisma: PrismaService): Promise<void> {
  await prisma.leadAssignment.deleteMany({
    where: { lead: { submission_id: { startsWith: 'cct-' } } },
  });
  await prisma.lead.deleteMany({ where: { submission_id: { startsWith: 'cct-' } } });
  await prisma.order.deleteMany({ where: { public_order_id: { startsWith: `${MARKER}-` } } });
  await prisma.client.deleteMany({ where: { email: CLIENT_EMAIL } });
  await prisma.user.deleteMany({ where: { work_email: AGENT_EMAIL } });
}

async function setup(prisma: PrismaService) {
  // Ensure SOLAR auto-distribution is not paused/held.
  await prisma.setting.deleteMany({ where: { key: 'distribution_controls' } });

  const agent = await prisma.user.create({
    data: { role: Role.AGENT, full_name: 'CCT Agent', work_email: AGENT_EMAIL, password_hash: 'x' },
  });
  const client = await prisma.client.create({
    data: { agent_id: agent.id, full_name: 'CCT Client', email: CLIENT_EMAIL, password_hash: 'x' },
  });

  // All orders are SOLAR with empty criteria → every lead overlaps every order.
  const orders = [];
  for (const spec of ORDER_SPECS) {
    orders.push(
      await prisma.order.create({
        data: {
          public_order_id: `${MARKER}-${spec.tag}`,
          client_id: client.id,
          lead_type: LeadType.SOLAR,
          criteria: {},
          delivery_mode: spec.mode,
          quantity_paid: spec.balance,
          quantity_remaining: spec.balance,
          queue_priority: spec.priority,
          unit_price: spec.price,
          total_amount: spec.price * spec.balance,
          status: OrderStatus.ACTIVE,
          paid_at: new Date(),
        },
      }),
    );
  }

  const leadIds: string[] = [];
  for (let i = 0; i < LEAD_COUNT; i += 1) {
    const lead = await prisma.lead.create({
      data: {
        public_lead_id: `${MARKER}-L-${i}`,
        submission_id: `cct-${i}`,
        lead_type: LeadType.SOLAR,
        full_name: `CCT Lead ${i}`,
        email: `cct-lead-${i}@concurrency.test`,
        lead_state: LeadState.VALID,
      },
    });
    leadIds.push(lead.id);
  }
  return { leadIds };
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const distribution = app.get(DistributionService);

  const failures: string[] = [];
  try {
    await cleanup(prisma);
    const { leadIds } = await setup(prisma);
    const initialBalance = ORDER_SPECS.reduce((sum, s) => sum + s.balance, 0);

    console.log(`Firing ${leadIds.length} VALID leads concurrently through the engine…`);
    const settled = await Promise.allSettled(leadIds.map((id) => distribution.distribute(id)));
    const rejected = settled.filter((r) => r.status === 'rejected');
    for (const r of rejected) {
      failures.push(`distribute() threw: ${String((r as PromiseRejectedResult).reason)}`);
    }

    // ── Gather final state ────────────────────────────────────────────────
    const orders = await prisma.order.findMany({
      where: { public_order_id: { startsWith: `${MARKER}-` } },
      orderBy: { public_order_id: 'asc' },
    });
    const assignments = await prisma.leadAssignment.findMany({
      where: { lead: { submission_id: { startsWith: 'cct-' } } },
    });
    const leads = await prisma.lead.findMany({
      where: { submission_id: { startsWith: 'cct-' } },
    });

    // ── Invariant 1: no negative balance; reconcile decrements ────────────
    let decremented = 0;
    for (const o of orders) {
      if (o.quantity_remaining < 0) {
        failures.push(`order ${o.public_order_id} balance ${o.quantity_remaining} < 0`);
      }
      decremented += o.quantity_paid - o.quantity_remaining;
    }

    // ── Invariants 2/3/no-double-bill: per-lead assignment constraints ────
    const byLead = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const list = byLead.get(a.lead_id);
      if (list) list.push(a);
      else byLead.set(a.lead_id, [a]);
    }
    for (const [leadId, list] of byLead) {
      const exclusive = list.filter((a) => a.delivery_mode === DeliveryMode.EXCLUSIVE).length;
      const shared = list.filter((a) => a.delivery_mode === DeliveryMode.SHARED).length;
      if (exclusive > 0 && list.length > 1) {
        failures.push(`lead ${leadId}: exclusive lead has ${list.length} assignments`);
      }
      if (shared > 4) {
        failures.push(`lead ${leadId}: ${shared} shared assignments (> 4)`);
      }
      const orderIds = list.map((a) => a.order_id);
      if (new Set(orderIds).size !== orderIds.length) {
        failures.push(`lead ${leadId}: billed to the same order twice`);
      }
    }

    // ── Invariant 4: totals reconcile ─────────────────────────────────────
    if (assignments.length !== decremented) {
      failures.push(
        `assignment count ${assignments.length} != balance decremented ${decremented}`,
      );
    }

    // Phase 7 rule: revenue is booked only on confirmed delivery — at
    // assignment time (no socket clients here) every revenue must be null.
    for (const a of assignments) {
      if (a.revenue !== null) {
        failures.push(`assignment ${a.id}: revenue ${a.revenue} booked before delivery confirmed`);
      }
    }

    // ── Invariant 5: every lead resolved ──────────────────────────────────
    for (const lead of leads) {
      const count = byLead.get(lead.id)?.length ?? 0;
      if (count > 0 && lead.lead_state !== LeadState.ASSIGNED) {
        failures.push(`lead ${lead.id}: ${count} assignments but state ${lead.lead_state}`);
      }
      if (count === 0 && lead.lead_state !== LeadState.UNSOLD_POOL) {
        failures.push(`lead ${lead.id}: 0 assignments but state ${lead.lead_state}`);
      }
    }

    // ── Report ────────────────────────────────────────────────────────────
    console.log('\nOrder                mode        priority  paid → remaining');
    for (const o of orders) {
      console.log(
        `  ${o.public_order_id.padEnd(18)} ${o.delivery_mode.padEnd(11)} ` +
          `${String(o.queue_priority).padStart(3)}      ${String(o.quantity_paid).padStart(3)} → ${o.quantity_remaining}`,
      );
    }
    const assignedLeads = leads.filter((l) => l.lead_state === LeadState.ASSIGNED).length;
    const unsoldLeads = leads.filter((l) => l.lead_state === LeadState.UNSOLD_POOL).length;
    console.log(
      `\nLeads: ${leads.length}  (assigned ${assignedLeads}, unsold ${unsoldLeads})` +
        `   Assignments: ${assignments.length}` +
        `   Balance decremented: ${decremented} / ${initialBalance}`,
    );

    if (failures.length === 0) {
      console.log('\n✔ ALL INVARIANTS HOLD — concurrency test PASSED');
    } else {
      console.error(`\n✖ ${failures.length} INVARIANT VIOLATION(S) — concurrency test FAILED`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('✖ Concurrency test crashed:', error);
    process.exitCode = 1;
  } finally {
    await cleanup(prisma);
    await app.close();
  }
}

void main();
