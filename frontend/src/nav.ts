import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Building2, Users, Boxes, Gauge, Settings, CalendarClock, Truck, Bell, HandHeart, HeartPulse, Gift, UserCircle, UserSearch } from 'lucide-react';
import type { Role } from './api/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly (overview routes). */
  end?: boolean;
}

/** Single source of truth: only items a role can access are rendered. Items are added as each phase ships. */
export const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/shelters', label: 'Shelters', icon: Building2 },
    { to: '/admin/occupancy', label: 'Occupancy', icon: Gauge },
    { to: '/admin/resources', label: 'Resources', icon: Boxes },
    { to: '/admin/transfers', label: 'Transfers', icon: Truck },
    { to: '/admin/alerts', label: 'Alerts', icon: Bell },
    { to: '/admin/volunteers', label: 'Volunteers', icon: HandHeart },
    { to: '/admin/medical', label: 'Medical', icon: HeartPulse },
    { to: '/admin/donations', label: 'Donations', icon: Gift },
    { to: '/admin/reunification', label: 'Reunification', icon: UserSearch },
  ],
  COORDINATOR: [
    { to: '/coordinator', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/coordinator/occupants', label: 'Occupants', icon: Users },
    { to: '/coordinator/resources', label: 'Resources', icon: Boxes },
    { to: '/coordinator/transfers', label: 'Transfers', icon: Truck },
    { to: '/coordinator/alerts', label: 'Alerts', icon: Bell },
    { to: '/coordinator/volunteers', label: 'Volunteers', icon: HandHeart },
    { to: '/coordinator/medical', label: 'Medical', icon: HeartPulse },
    { to: '/coordinator/donations', label: 'Donations', icon: Gift },
    { to: '/coordinator/reunification', label: 'Reunification', icon: UserSearch },
    { to: '/coordinator/shelter', label: 'Shelter settings', icon: Settings },
  ],
  VOLUNTEER: [
    { to: '/volunteer', label: 'Available shifts', icon: CalendarClock, end: true },
    { to: '/volunteer/my-shifts', label: 'My shifts', icon: HandHeart },
    { to: '/volunteer/profile', label: 'Profile', icon: UserCircle },
  ],
};

export const HOME_FOR_ROLE: Record<Role, string> = {
  ADMIN: '/admin',
  COORDINATOR: '/coordinator',
  VOLUNTEER: '/volunteer',
};
