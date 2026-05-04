import type { UserRole, UserStatus } from "@/app/generated/prisma/enums";

// ── Service-layer DTOs ──

export type { UserRole, UserStatus };

export interface CreateUserInput {
  email?: string;
  password?: string;
  name: string;
  telegramId: string;
  botToken?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  telegramId?: string;
  botToken?: string;
  role?: UserRole;
  status?: UserStatus;
  validUntil?: Date | null;
  isLocked?: boolean;
}

export interface UserFilter {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
}

export interface CreateRouterInput {
  name: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  label?: string;
  isDefault?: boolean;
  // tenantId di-inject otomatis dari session di service layer (tidak perlu pass)
  // WAN interface untuk kalkulasi traffic (opsional)
  wanInterface?: string;
  // MikroTik DNS settings
  dnsHotspot?: string;
  // Hotspot branding (untuk header voucher cetak)
  hotspotName?: string;
  hotspotLogoUrl?: string;
  // Telegram bot integration (optional)
  telegramOwnerUsername?: string;
  telegramOwnerId?: string;
  botToken?: string;
  botUsername?: string;
}

export interface LogFilter {
  userId?: string;
  action?: string;
  status?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRouters: number;
  totalLogs: number;
  recentActivity: number;
}

// ── Reseller Types ──

export interface CreateResellerInput {
  name: string;
  phone?: string;
  telegramId?: string;
  balance?: number;
  discount?: number;
  voucherGroup?: string;
  uplink?: string;
}

export interface UpdateResellerInput {
  name?: string;
  phone?: string;
  telegramId?: string;
  status?: "ACTIVE" | "INACTIVE";
  discount?: number;
  voucherGroup?: string;
  uplink?: string;
}

export interface SaldoOperationInput {
  amount: number;
  description?: string;
  proofImageUrl?: string;
}

export interface GenerateVouchersInput {
  routerName: string;
  profile: string;
  count: number;
  pricePerUnit: number;
  prefix?: string;
  passwordLength?: number;
  usernameLength?: number;
  charType?: string;
  loginType?: string;
  limitUptime?: string;
  limitBytesTotal?: string;
  server?: string;
}

export interface VoucherBatchResult {
  id: string;
  routerName: string;
  profile: string;
  count: number;
  pricePerUnit: number;
  totalCost: number;
  vouchers: { username: string; password: string }[];
  source: string;
  createdAt: string;
  resellerId: string | null;
}

export interface VoucherFilter {
  routerName?: string;
  resellerId?: string;
  source?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

// ── Hotspot Types ──

export interface HotspotUser {
  name: string;
  profile: string;
  server: string;
  limitUptime: string;
  limitBytesTotal: string;
  disabled: boolean;
  comment: string;
}

export interface HotspotActive {
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  server: string;
  bytesIn: number;
  bytesOut: number;
}

export interface HotspotProfile {
  name: string;
  rateLimit: string;
  sharedUsers: string;
  sessionTimeout: string;
}

export interface HotspotStats {
  totalUsers: number;
  enabledUsers: number;
  disabledUsers: number;
  activeSessions: number;
}

// ── PPP Types ──

export interface PPPSecret {
  name: string;
  service: string;
  profile: string;
  localAddress: string;
  remoteAddress: string;
  disabled: boolean;
  comment: string;
}

export interface PPPActive {
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  encoding: string;
}

export interface PPPProfile {
  name: string;
  localAddress: string;
  remoteAddress: string;
  rateLimit: string;
}

// ── Tunnel Types ──

export type TunnelMethod = 'CLOUDFLARE' | 'SSTP' | 'OVPN' | 'WIREGUARD'
export type TunnelStatus = 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
export type ConnectionMethod = 'DIRECT' | 'TUNNEL'
export type TunnelServiceName = 'api' | 'winbox' | 'ssh' | 'webfig' | 'api-ssl'

export interface TunnelPort {
  id: string
  serviceName: TunnelServiceName
  remotePort: number
  localPort: number | null
  hostname: string | null
  enabled: boolean
  tunnelId: string
}

export interface Tunnel {
  id: string
  method: TunnelMethod
  status: TunnelStatus
  cloudflareTunnelId: string | null
  tunnelHostname: string | null
  vpnAssignedIp: string | null
  routerLanIp: string
  lastConnectedAt: string | null
  createdAt: string
  updatedAt: string
  routerId: string
  ports: TunnelPort[]
  // WireGuard / OVPN shared fields
  winboxPort: number | null
  subnetOctet: number | null
  routerOctet: number | null
  wgClientPubKey: string | null
  wgServerPubKey: string | null
}

export const TUNNEL_SERVICES: { serviceName: TunnelServiceName; remotePort: number; label: string; defaultEnabled: boolean }[] = [
  { serviceName: 'api',     remotePort: 8728, label: 'API (8728)',     defaultEnabled: true },
  { serviceName: 'winbox',  remotePort: 8291, label: 'Winbox (8291)', defaultEnabled: true },
  { serviceName: 'ssh',     remotePort: 22,   label: 'SSH (22)',       defaultEnabled: false },
  { serviceName: 'webfig',  remotePort: 80,   label: 'WebFig (80)',    defaultEnabled: false },
  { serviceName: 'api-ssl', remotePort: 8729, label: 'API-SSL (8729)', defaultEnabled: false },
]
