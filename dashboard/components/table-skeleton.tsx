export function TableSkeleton({
  rows = 5,
  columns = 6,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={className}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-3 py-3 md:px-6 md:py-5">
              <div className="h-4 w-20 animate-pulse rounded bg-[#222a3d]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
