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
  userId: string;
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
}

export interface UpdateResellerInput {
  name?: string;
  phone?: string;
  telegramId?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface SaldoOperationInput {
  amount: number;
  description?: string;
}

export interface GenerateVouchersInput {
  routerName: string;
  profile: string;
  count: number;
  pricePerUnit: number;
  prefix?: string;
  passwordLength?: number;
  usernameLength?: number;
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
