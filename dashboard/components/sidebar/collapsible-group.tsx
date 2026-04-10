"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NavGroup } from "./nav-config"

interface CollapsibleGroupProps {
  group: NavGroup
  isAdmin: boolean
  pathname: string
  isOpen: boolean
  onToggle: () => void
  onNavClick: () => void
}

export function CollapsibleGroup({
  group,
  isAdmin,
  pathname,
  isOpen,
  onToggle,
  onNavClick,
}: CollapsibleGroupProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const isAlwaysOpen = group.defaultOpen === true

  const filteredItems = group.items.filter(
    (item) => !item.adminOnly || isAdmin
  )

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight)
    }
  }, [filteredItems.length])

  if (filteredItems.length === 0) return null

  return (
    <div>
      {/* Group header */}
      {isAlwaysOpen ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-4 mb-1">
          {group.label}
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="flex items-center w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-4 mb-1 hover:text-muted-foreground transition-colors duration-200 cursor-pointer"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 mr-1.5 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          {group.label}
        </button>
      )}

      {/* Group items */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{
          maxHeight: isAlwaysOpen || isOpen ? (maxHeight ?? 1000) : 0,
        }}
      >
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || (pathname?.startsWith(item.href + "/") && !filteredItems.some((o) => o.href !== item.href && o.href.length > item.href.length && pathname?.startsWith(o.href)))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-all duration-300",
                isActive
                  ? "text-primary border-r-2 border-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
