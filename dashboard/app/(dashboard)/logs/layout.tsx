import { ReactNode } from "react"
import { LogsTabs } from "@/components/logs-tabs"

export default function LogsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <LogsTabs />
      {children}
    </div>
  )
}
