import {
  BarChart3,
  Building2,
  Database,
  DollarSign,
  Globe,
  LayoutDashboard,
  Megaphone,
  RefreshCw,
  ScrollText,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import type { NavLink } from './SidebarShell';

/** Nav blueprint shared by SidebarShell. Sections render as labeled groups. */
export interface NavSection {
  label: string;
  items: NavLink[];
}

export const SUPER_ADMIN_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/super-admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Management',
    items: [
      { href: '/super-admin/users', label: 'Users', icon: Users },
      { href: '/super-admin/clients', label: 'Clients', icon: Building2 },
      { href: '/super-admin/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/super-admin/landing-pages', label: 'Landing Pages', icon: Globe },
      { href: '/super-admin/pricing', label: 'Pricing', icon: DollarSign },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/super-admin/leads', label: 'Leads', icon: Database },
      { href: '/super-admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/super-admin/replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/super-admin/reports', label: 'Reports', icon: BarChart3 },
      { href: '/super-admin/audit', label: 'Audit', icon: ScrollText },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/clients', label: 'Clients', icon: Building2 },
      { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/admin/landing-pages', label: 'Landing Pages', icon: Globe },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/leads', label: 'Leads', icon: Database },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/admin/replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
  {
    label: 'Insights',
    items: [{ href: '/admin/reports', label: 'Reports', icon: BarChart3 }],
  },
];

export const AGENT_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/agent', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'My book',
    items: [
      { href: '/agent/clients', label: 'My Clients', icon: Building2 },
      { href: '/agent/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/agent/landing-pages', label: 'Landing Pages', icon: Globe },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/agent/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/agent/replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
];

export const CLIENT_NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ href: '/client', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Buying',
    items: [
      { href: '/client/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/client/leads', label: 'Live Leads', icon: Zap },
      { href: '/client/replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
];
