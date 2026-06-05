import {
  BarChart3,
  Banknote,
  Building2,
  Database,
  DollarSign,
  Globe,
  Home,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  RefreshCw,
  ScrollText,
  ShieldOff,
  ShoppingCart,
  Sun,
  Ticket,
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
      { href: '/super-admin/lead-columns', label: 'Lead Columns', icon: ScrollText },
      { href: '/super-admin/pricing', label: 'Pricing', icon: DollarSign },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/super-admin/leads', label: 'Leads', icon: Database, exact: true },
      { href: '/super-admin/leads/sweepstakes', label: 'Sweepstakes', icon: Ticket, nested: true },
      { href: '/super-admin/leads/solar', label: 'Solar', icon: Sun, nested: true },
      { href: '/super-admin/leads/payday', label: 'Payday', icon: Banknote, nested: true },
      { href: '/super-admin/leads/homeowner', label: 'Homeowner', icon: Home, nested: true },
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
  {
    label: 'Compliance & vault',
    items: [
      { href: '/super-admin/suppression', label: 'Suppression', icon: ShieldOff },
      { href: '/super-admin/api-keys', label: 'API keys', icon: KeyRound },
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
      { href: '/admin/leads', label: 'Leads', icon: Database, exact: true },
      { href: '/admin/leads/sweepstakes', label: 'Sweepstakes', icon: Ticket, nested: true },
      { href: '/admin/leads/solar', label: 'Solar', icon: Sun, nested: true },
      { href: '/admin/leads/payday', label: 'Payday', icon: Banknote, nested: true },
      { href: '/admin/leads/homeowner', label: 'Homeowner', icon: Home, nested: true },
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
      { href: '/agent/leads', label: 'Leads', icon: Database },
      { href: '/agent/leads/sweepstakes', label: 'Sweepstakes', icon: Ticket, nested: true },
      { href: '/agent/leads/solar', label: 'Solar', icon: Sun, nested: true },
      { href: '/agent/leads/payday', label: 'Payday', icon: Banknote, nested: true },
      { href: '/agent/leads/homeowner', label: 'Homeowner', icon: Home, nested: true },
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
      { href: '/client/leads', label: 'My Leads', icon: Zap },
      { href: '/client/leads/sweepstakes', label: 'Sweepstakes', icon: Ticket, nested: true },
      { href: '/client/leads/solar', label: 'Solar', icon: Sun, nested: true },
      { href: '/client/leads/payday', label: 'Payday', icon: Banknote, nested: true },
      { href: '/client/leads/homeowner', label: 'Homeowner', icon: Home, nested: true },
      { href: '/client/replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/client/billing', label: 'Billing', icon: DollarSign },
      { href: '/client/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
];
