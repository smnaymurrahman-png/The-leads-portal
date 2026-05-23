/**
 * RBAC route audit.
 *
 * Boots the Nest application, walks every controller, and prints each HTTP
 * route with its access requirement — PUBLIC, a specific role set, or
 * "any authenticated". Use it to confirm no route is unintentionally exposed.
 *
 * Run with:  pnpm --filter @leads-portal/api rbac:audit
 */
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';

/* eslint-disable no-console */

interface RouteRow {
  method: string;
  path: string;
  access: string;
}

function joinPath(base: string, sub: string): string {
  const trimmed = [base, sub].map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean);
  return `/api/${trimmed.join('/')}`.replace(/\/+$/, '') || '/api';
}

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const modules = app.get(ModulesContainer);
  const rows: RouteRow[] = [];

  for (const module of modules.values()) {
    for (const wrapper of module.controllers.values()) {
      const instance = wrapper.instance as object | undefined;
      if (!instance) {
        continue;
      }
      const ctor = instance.constructor;
      const basePath: string = Reflect.getMetadata(PATH_METADATA, ctor) ?? '';
      const classRoles: string[] | undefined = Reflect.getMetadata(ROLES_KEY, ctor);
      const classPublic: boolean | undefined = Reflect.getMetadata(IS_PUBLIC_KEY, ctor);
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;

      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') {
          continue;
        }
        const handler = proto[name];
        if (typeof handler !== 'function') {
          continue;
        }
        const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (methodPath === undefined || httpMethod === undefined) {
          continue;
        }

        const roles: string[] | undefined =
          Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles;
        const isPublic: boolean | undefined =
          Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? classPublic;

        rows.push({
          method: RequestMethod[httpMethod] ?? String(httpMethod),
          path: joinPath(basePath, methodPath),
          access: isPublic
            ? 'PUBLIC (no JWT — guarded another way)'
            : roles && roles.length > 0
              ? `ROLES: ${roles.join(', ')}`
              : 'AUTHENTICATED (any role)',
        });
      }
    }
  }

  rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  console.log(`\nRBAC route audit — ${rows.length} routes\n`);
  for (const row of rows) {
    console.log(`  ${row.method.padEnd(7)}${row.path.padEnd(48)}${row.access}`);
  }

  const publicCount = rows.filter((r) => r.access.startsWith('PUBLIC')).length;
  const roleCount = rows.filter((r) => r.access.startsWith('ROLES')).length;
  const anyAuthCount = rows.filter((r) => r.access.startsWith('AUTHENTICATED')).length;
  console.log(
    `\n  Summary: ${publicCount} public, ${roleCount} role-restricted, ` +
      `${anyAuthCount} any-authenticated\n`,
  );

  await app.close();
}

void main();
