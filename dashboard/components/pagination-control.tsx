import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function PaginationControl({
  page,
  totalPages,
  total,
  onPageChange,
  label,
}: {
  page: number
  totalPages: number
  total?: number
  onPageChange: (page: number) => void
  label?: string
}) {
  if (totalPages <= 1) return null

  return (
    <div className="px-6 py-4 bg-muted/50 flex items-center justify-between border-t border-border">
      <span className="text-xs text-muted-foreground/70">
        {label ?? `Page ${page} of ${totalPages}${total != null ? ` (${total} total)` : ""}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="p-1 hover:bg-muted rounded-lg disabled:opacity-30"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            const p = i + 1
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg",
                  page === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
        <button
          className="p-1 hover:bg-muted rounded-lg disabled:opacity-30"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
