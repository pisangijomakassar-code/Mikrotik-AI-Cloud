# Google Stitch UI Prompt

Copy paste prompt di bawah ini ke Google Stitch:

---

Build a modern admin dashboard for "MikroTik AI Agent" — a SaaS platform where admins manage paid users who control MikroTik routers via Telegram AI chatbot.

## Tech Stack
- React + TypeScript
- Tailwind CSS
- Shadcn/ui components
- Dark mode by default, with light mode toggle
- Responsive (mobile + desktop)

## Pages & Features

### 1. Login Page
- Simple email + password login
- Logo: router icon with AI sparkle
- Brand name: "MikroTik AI Agent"
- Tagline: "Manage your routers with AI"

### 2. Dashboard (Home)
Overview cards showing:
- Total active users (number with trend arrow)
- Total routers managed across all users
- Total active clients across all routers
- System status: API health, LLM status (green/red badge)
- Recent activity feed (last 10 actions: "User Pak Budi added router Kantor", "User Andi checked firewall rules", etc.)

### 3. User Management Page
Table with columns:
- User ID (Telegram numeric ID)
- Name
- Telegram Bot Token (masked: `8717***Z50`)
- Routers count
- Status: Active / Inactive (toggle switch)
- Created date
- Actions: Edit, Delete, View Details

**Add User Modal:**
- Fields: Name, Telegram User ID, Telegram Bot Token, OpenRouter API Key (optional, uses default if empty)
- "Add User" button
- Shows success toast with bot link

**User Detail Page (click on user):**
- User info card
- List of registered routers with status (online/offline)
- Recent chat history summary
- Usage stats: queries today, queries this month
- Button: "Restart Agent" / "Pause Agent"

### 4. Router Overview Page
Table of ALL routers across all users:
- Router name
- Owner (user name)
- Host:Port
- RouterOS version
- Board name
- Status: Online / Offline (green/red dot)
- Last seen timestamp
- CPU / Memory usage (progress bars)
- Active clients count

Click on a router → Router Detail page:
- System info card
- Interface list with traffic stats
- Active DHCP clients
- Firewall rules count
- Quick actions: "Check Health", "View Logs"

### 5. Settings Page
- **LLM Configuration**: Model name, API key (masked), provider
- **Default Settings**: Default system prompt, response language, max response length
- **Telegram Settings**: Default bot settings
- **Backup**: Export all user data (JSON), Import data
- **Danger Zone**: Reset all data, Force restart all agents

### 6. Sidebar Navigation
- Logo + brand name at top
- Dashboard (home icon)
- Users (people icon)
- Routers (server icon)
- Logs (file-text icon)
- Settings (gear icon)
- Collapse toggle

### 7. Activity Logs Page
Filterable log table:
- Timestamp
- User
- Router
- Action (read/write/admin)
- Tool called (e.g., "count_active_clients")
- Status (success/error)
- Duration (ms)

Filters: by user, by router, by action type, by date range

## Design Guidelines
- Color scheme: Dark navy background (#0f172a), with cyan/teal accents (#06b6d4) for primary actions
- Cards with subtle borders and glass-morphism effect
- Status indicators: green (#22c55e) for online/success, red (#ef4444) for offline/error, amber (#f59e0b) for warning
- Monospace font for technical data (IPs, MACs, versions)
- Smooth transitions and hover effects
- Toast notifications for actions
- Confirmation dialog for destructive actions (delete user, remove router)
- Empty states with illustrations and helpful text

## Data Models (for mock data)

```typescript
interface User {
  id: string;
  name: string;
  telegramUserId: string;
  telegramBotToken: string;
  status: 'active' | 'inactive';
  routersCount: number;
  createdAt: string;
  lastActive: string;
}

interface Router {
  name: string;
  ownerId: string;
  ownerName: string;
  host: string;
  port: number;
  board: string;
  version: string;
  status: 'online' | 'offline';
  cpuLoad: number;
  memoryUsed: number;
  memoryTotal: number;
  activeClients: number;
  lastSeen: string;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  routerName: string;
  action: 'read' | 'write' | 'admin';
  tool: string;
  status: 'success' | 'error';
  durationMs: number;
  details: string;
}
```

Generate mock data for 5 users, 8 routers, and 20 activity logs.

## Important
- Make all pages fully functional with mock data
- Include loading states and skeleton screens
- Add search/filter functionality where applicable
- Make the dashboard feel like a professional network management tool
- All text in English, but keep Indonesian terms for router-specific labels where natural (e.g., "Kantor", "Cabang", "Rumah")

---
