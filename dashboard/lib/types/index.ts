import type { UserRole, UserStatus } from "@/app/generated/prisma/enums";

// ── Service-layer DTOs ──

export type { UserRole, UserStatus };

export interface CreateUserInput {
  email?: string;
  password?: string;
  name: string;
  telegramId: string;
  botToken?: string;
  agentUrl?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  telegramId?: string;
  botToken?: string;
  agentUrl?: string;
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
