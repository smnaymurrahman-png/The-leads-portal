'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Banknote, Home, Sun, Ticket, Zap } from 'lucide-react';
import {
  ADMIN_NAV,
  AGENT_NAV,
  CLIENT_NAV,
  SUPER_ADMIN_NAV,
  type NavSection,
} from '@/components/nav-config';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { LogoutButton } from './LogoutButton';
import { NotificationsBell } from './NotificationsBell';
import { NotificationsProvider } from './NotificationsProvider';

export interface NavLink {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Visually indent under a parent item (no link nesting, just left padding). */
  nested?: boolean;
  /** Only highlight when the route matches exactly — used by parent items
   *  that have child sub-routes (e.g. Leads with per-type sub-pages). */
  exact?: boolean;
}

export interface SessionLike {
  name: string;
  email: string;
  role: string;
}

/**
 * App chrome shared by every role area: branded sidebar on the left, slim
 * header with the area name + sign-out on the right, and the page in the
 * main scroll area below it.
 */
/** Discriminator for role-area selection; lookups stay on the client. */
export type AreaKey = 'super-admin' | 'admin' | 'agent' | 'client';

const NAV_BY_AREA: Record<AreaKey, NavSection[]> = {
  'super-admin': SUPER_ADMIN_NAV,
  admin: ADMIN_NAV,
  agent: AGENT_NAV,
  client: CLIENT_NAV,
};

const LEAD_TYPE_NAV: Record<string, { label: string; href: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  SOLAR:       { label: 'Solar Leads',       href: '/client/leads/solar',       icon: Sun },
  SWEEPSTAKES: { label: 'Sweepstakes Leads', href: '/client/leads/sweepstakes', icon: Ticket },
  PAYDAY:      { label: 'Payday Leads',      href: '/client/leads/payday',      icon: Banknote },
  HOMEOWNER:   { label: 'Homeowner Leads',   href: '/client/leads/homeowner',   icon: Home },
};

function buildClientLeadNav(leadType?: string | null): NavSection[] {
  const item = leadType ? LEAD_TYPE_NAV[leadType] : null;
  return CLIENT_NAV.map((section) => {
    if (section.label !== 'Buying') return section;
    return {
      ...section,
      items: section.items
        .filter((i) => !i.nested)
        .map((i) =>
          i.href === '/client/leads'
            ? item
              ? { href: item.href, label: item.label, icon: item.icon }
              : { ...i, icon: Zap }
            : i,
        ),
    };
  });
}

export function SidebarShell({
  area,
  areaKey,
  clientLeadType,
  profileHref,
  session,
  children,
}: {
  area: string;
  areaKey: AreaKey;
  /** Serializable lead-type string for the client portal dynamic nav.
   *  Avoids passing icon component refs across the server→client boundary. */
  clientLeadType?: string | null;
  profileHref: string;
  session: SessionLike;
  children: ReactNode;
}) {
  const navSections = clientLeadType !== undefined
    ? buildClientLeadNav(clientLeadType)
    : NAV_BY_AREA[areaKey];
  const initials = session.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const pathname = usePathname();

  /**
   * Match exact paths plus their descendants — but don't let the dashboard
   * root (e.g. `/super-admin`) claim every sibling page underneath it.
   * `/super-admin/users` is active for itself and any `/super-admin/users/*`
   * detail route; `/super-admin` is active only on the bare dashboard.
   */
  function isActive(href: string, exact?: boolean): boolean {
    if (pathname === href) return true;
    if (exact) return false;
    const depth = href.split('/').filter(Boolean).length;
    return depth > 1 && pathname.startsWith(`${href}/`);
  }

  return (
    <NotificationsProvider>
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="border-b">
          <div className="flex items-center gap-2 px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Leads Portal" className="h-8 w-8 rounded-lg shrink-0 object-cover" />
            <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold tracking-tight">Leads Portal</span>
              <span className="text-xs text-muted-foreground">{area}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {navSections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map(({ href, label, icon: Icon, nested, exact }) => {
                    const active = isActive(href, exact);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          tooltip={label}
                          isActive={active}
                          className={nested ? 'pl-8' : undefined}
                        >
                          <Icon className="size-4" />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t">
          <Link
            href={profileHref}
            className="-mx-1 flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent/40"
            title="Profile & password"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">
                {initials || '··'}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-medium">{session.name}</span>
              <span className="truncate text-xs text-muted-foreground">{session.email}</span>
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur lg:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{area}</span>
            <div className="flex items-center gap-1">
              <NotificationsBell />
              <LogoutButton />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-5 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </NotificationsProvider>
  );
}
