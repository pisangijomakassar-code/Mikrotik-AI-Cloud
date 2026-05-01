"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  RefreshCw, Save, MousePointer2, Link2, Star, Pencil, Trash2,
  Wifi, WifiOff, AlertTriangle, Radio,
} from "lucide-react"
import { useActiveRouter } from "@/components/active-router-context"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface TopologyNode {
  id: string
  host: string
  label: string
  x: number
  y: number
  isCentral: boolean
  parentId: string | null
  status: string         // "up" | "down" | "unknown"
  comment: string
  since: string
}

interface TopologyResponse {
  router: string
  nodes: TopologyNode[]
}

type Mode = "drag" | "edge" | "central" | "label" | "delete"

const VIEW_W = 1200
const VIEW_H = 600

export default function NetwatchTopologyPage() {
  const { activeRouter } = useActiveRouter()
  const qc = useQueryClient()
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [mode, setMode] = useState<Mode>("drag")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [edgeFromId, setEdgeFromId] = useState<string | null>(null)
  const [localNodes, setLocalNodes] = useState<TopologyNode[] | null>(null)
  const [dirty, setDirty] = useState(false)

  const dragStateRef = useRef<{
    id: string
    startNodeX: number
    startNodeY: number
    startMouseX: number
    startMouseY: number
  } | null>(null)

  const query = useQuery<TopologyResponse>({
    queryKey: ["netwatch-topology", activeRouter ?? ""],
    queryFn: () => {
      const qs = activeRouter ? `?router=${encodeURIComponent(activeRouter)}` : ""
      return apiClient.get<TopologyResponse>(`/api/netwatch/topology${qs}`)
    },
    enabled: !!activeRouter,
    refetchInterval: dirty ? false : 30_000,
    retry: false,
  })

  // Sync server data → local state (kecuali sedang dirty, jgn override edit user)
  useEffect(() => {
    if (query.data && !dirty) {
      setLocalNodes(query.data.nodes)
    }
  }, [query.data, dirty])

  const nodes = localNodes ?? []
  const selected = nodes.find((n) => n.id === selectedId) || null

  const upCount = nodes.filter((n) => n.status === "up").length
  const downCount = nodes.filter((n) => n.status === "down").length
  const central = nodes.find((n) => n.isCentral) || null
  const downNodes = nodes.filter((n) => n.status === "down")

  const saveMutation = useMutation({
    mutationFn: (payload: TopologyNode[]) =>
      apiClient.put(`/api/netwatch/topology`, {
        router: activeRouter,
        nodes: payload.map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
          parentId: n.parentId,
          isCentral: n.isCentral,
          label: n.label,
        })),
      }),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ["netwatch-topology", activeRouter ?? ""] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(
        `/api/netwatch/topology?router=${encodeURIComponent(activeRouter || "")}&id=${id}`
      ),
    onSuccess: () => {
      setSelectedId(null)
      qc.invalidateQueries({ queryKey: ["netwatch-topology", activeRouter ?? ""] })
    },
  })

  // ── Mouse → SVG coords ──────────────────────────────────────
  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const inv = ctm.inverse()
    const local = pt.matrixTransform(inv)
    return { x: local.x, y: local.y }
  }

  // ── Node click handler (mode-aware) ─────────────────────────
  function handleNodeMouseDown(e: React.MouseEvent, node: TopologyNode) {
    e.stopPropagation()

    if (mode === "drag") {
      dragStateRef.current = {
        id: node.id,
        startNodeX: node.x,
        startNodeY: node.y,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
      }
      setSelectedId(node.id)
      return
    }

    if (mode === "edge") {
      if (!edgeFromId) {
        setEdgeFromId(node.id)
        setSelectedId(node.id)
      } else if (edgeFromId === node.id) {
        setEdgeFromId(null)
      } else {
        // Set node.parent = edgeFromId
        setLocalNodes((prev) =>
          (prev ?? []).map((n) =>
            n.id === node.id ? { ...n, parentId: edgeFromId } : n
          )
        )
        setDirty(true)
        setEdgeFromId(null)
      }
      return
    }

    if (mode === "central") {
      // Toggle: only one central allowed
      setLocalNodes((prev) =>
        (prev ?? []).map((n) => ({
          ...n,
          isCentral: n.id === node.id ? !n.isCentral : false,
        }))
      )
      setDirty(true)
      return
    }

    if (mode === "label") {
      const newLabel = prompt("Label baru untuk node ini:", node.label || node.host)
      if (newLabel !== null) {
        setLocalNodes((prev) =>
          (prev ?? []).map((n) =>
            n.id === node.id ? { ...n, label: newLabel } : n
          )
        )
        setDirty(true)
      }
      return
    }

    if (mode === "delete") {
      if (confirm(`Hapus node "${node.label || node.host}" dari topology?\n(Tidak menghapus dari netwatch RouterOS — hanya layout)`)) {
        deleteMutation.mutate(node.id)
      }
      return
    }
  }

  // ── Global mouse move/up for drag ───────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const ds = dragStateRef.current
      if (!ds) return
      const startLocal = svgPoint(ds.startMouseX, ds.startMouseY)
      const curLocal = svgPoint(e.clientX, e.clientY)
      const dx = curLocal.x - startLocal.x
      const dy = curLocal.y - startLocal.y
      setLocalNodes((prev) =>
        (prev ?? []).map((n) =>
          n.id === ds.id
            ? { ...n, x: Math.max(60, Math.min(VIEW_W - 60, ds.startNodeX + dx)),
                       y: Math.max(30, Math.min(VIEW_H - 30, ds.startNodeY + dy)) }
            : n
        )
      )
      setDirty(true)
    }
    function onUp() {
      dragStateRef.current = null
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [])

  if (!activeRouter) {
    return (
      <div className="card-glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
        Pilih router dulu di header untuk lihat topology
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold text-foreground">Netwatch Topology</h1>
            {dirty && (
              <span className="px-2 py-0.5 bg-orange-400/10 text-orange-400 text-[10px] rounded font-bold">
                UNSAVED
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {activeRouter} · {nodes.length} AP · {upCount} UP / {downCount} DOWN · auto-refresh 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => query.refetch()}
            className="card-glass rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
            Refresh
          </button>
          <button
            disabled={!dirty || saveMutation.isPending}
            onClick={() => localNodes && saveMutation.mutate(localNodes)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs flex items-center gap-2",
              dirty
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "card-glass opacity-50 cursor-not-allowed"
            )}
          >
            <Save className={cn("h-3.5 w-3.5", saveMutation.isPending && "animate-pulse")} />
            {saveMutation.isPending ? "Saving..." : "Save Layout"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total AP" value={String(nodes.length)} />
        <SummaryCard label="UP" value={String(upCount)} color="text-tertiary" icon={<Wifi className="h-4 w-4 text-tertiary" />} />
        <SummaryCard label="DOWN" value={String(downCount)} color="text-destructive" icon={<WifiOff className="h-4 w-4 text-destructive" />} />
        <SummaryCard label="Pusat (HUB)" value={central ? (central.label || central.host) : "-"} small />
      </div>

      {/* Toolbar mode */}
      <div className="card-glass rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ModeBtn active={mode === "drag"} onClick={() => { setMode("drag"); setEdgeFromId(null) }} icon={<MousePointer2 className="h-3.5 w-3.5" />} label="Drag" />
          <ModeBtn active={mode === "edge"} onClick={() => { setMode("edge"); setEdgeFromId(null) }} icon={<Link2 className="h-3.5 w-3.5" />} label="Tambah Edge" />
          <ModeBtn active={mode === "central"} onClick={() => { setMode("central"); setEdgeFromId(null) }} icon={<Star className="h-3.5 w-3.5" />} label="Set Pusat" />
          <ModeBtn active={mode === "label"} onClick={() => { setMode("label"); setEdgeFromId(null) }} icon={<Pencil className="h-3.5 w-3.5" />} label="Edit Label" />
          <ModeBtn active={mode === "delete"} onClick={() => { setMode("delete"); setEdgeFromId(null) }} icon={<Trash2 className="h-3.5 w-3.5" />} label="Hapus" />
        </div>
        <div className="text-[10px] text-muted-foreground/70">
          {mode === "drag" && "Drag node untuk pindah posisi"}
          {mode === "edge" && (edgeFromId
            ? "Klik node tujuan (anak) untuk konek estafet — atau klik ulang node sumber untuk batal"
            : "Klik node sumber (parent) dulu, lalu klik node tujuan (anak)")}
          {mode === "central" && "Klik node yang mau dijadikan pusat (HUB)"}
          {mode === "label" && "Klik node untuk rename label"}
          {mode === "delete" && "Klik node untuk hapus dari layout (tidak hapus dari netwatch RouterOS)"}
        </div>
      </div>

      {/* Canvas */}
      <div className="card-glass rounded-2xl overflow-hidden" style={{ height: 600 }}>
        {query.isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Loading topology...
          </div>
        ) : query.isError ? (
          <div className="h-full flex items-center justify-center text-sm text-destructive">
            Tidak bisa fetch topology. Pastikan router online.
          </div>
        ) : nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
            <Radio className="h-8 w-8 opacity-50" />
            Belum ada netwatch entry. Tambah lewat Winbox dulu:
            <code className="text-xs bg-muted/40 px-2 py-1 rounded">/tool netwatch add host=&lt;ip&gt;</code>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
            onClick={() => { if (mode === "drag") setSelectedId(null) }}
          >
            {/* Edges */}
            {nodes.map((n) => {
              if (!n.parentId) return null
              const parent = nodes.find((p) => p.id === n.parentId)
              if (!parent) return null
              const isDown = n.status === "down"
              return (
                <line
                  key={`edge-${n.id}`}
                  x1={parent.x}
                  y1={parent.y}
                  x2={n.x}
                  y2={n.y}
                  stroke={isDown ? "rgba(255,180,171,0.4)" : "rgba(96,165,250,0.5)"}
                  strokeWidth={2}
                  strokeDasharray={isDown ? "4 4" : undefined}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((n) => (
              <NodeBox
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                edgeSource={edgeFromId === n.id}
                onMouseDown={(e) => handleNodeMouseDown(e, n)}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Detail + Alert + History */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Detail node */}
        <div className="card-glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Detail Node Terpilih
          </div>
          {selected ? (
            <div className="text-sm space-y-1">
              <div className="text-foreground font-bold flex items-center gap-1">
                {selected.isCentral ? "⭐" : selected.status === "down" ? "📡" : "📶"}{" "}
                {selected.label || selected.host}
              </div>
              <div className="text-muted-foreground text-xs">
                IP: <code className="text-blue-300">{selected.host}</code>
              </div>
              <div className="text-muted-foreground text-xs">
                Status:{" "}
                <span className={selected.status === "up" ? "text-tertiary" : selected.status === "down" ? "text-destructive" : "text-muted-foreground"}>
                  ● {selected.status.toUpperCase()}
                  {selected.since ? ` sejak ${new Date(selected.since).toLocaleString("id-ID")}` : ""}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                Parent:{" "}
                {selected.parentId
                  ? nodes.find((p) => p.id === selected.parentId)?.label ||
                    nodes.find((p) => p.id === selected.parentId)?.host || "-"
                  : (selected.isCentral ? "(HUB / pusat)" : "(belum di-set)")}
              </div>
              <div className="text-muted-foreground text-xs">
                Children:{" "}
                {nodes.filter((c) => c.parentId === selected.id).map((c) => c.label || c.host).join(", ") || "-"}
              </div>
              {selected.comment && (
                <div className="text-muted-foreground text-xs italic">Comment: {selected.comment}</div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground/70">
              Klik node untuk lihat detail
            </div>
          )}
        </div>

        {/* Alert AP DOWN */}
        <div className="card-glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" /> Alert AP DOWN
          </div>
          {downNodes.length === 0 ? (
            <div className="text-xs text-tertiary">Semua AP UP ✓</div>
          ) : (
            <div className="text-sm space-y-2">
              {downNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className="w-full text-left bg-destructive/10 p-2 rounded border border-destructive/20 hover:bg-destructive/15"
                >
                  <div className="text-foreground font-semibold text-xs">📡 {n.label || n.host}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {n.since ? `DOWN sejak ${new Date(n.since).toLocaleString("id-ID")}` : "DOWN"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{n.host}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card-glass rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Statistik Topology
          </div>
          <div className="space-y-1.5 text-xs">
            <Row label="Pusat (HUB)" value={central ? (central.label || central.host) : "(belum di-set)"} />
            <Row label="Node terhubung" value={`${nodes.filter((n) => n.parentId || n.isCentral).length} / ${nodes.length}`} />
            <Row label="Node orphan (tanpa parent)" value={String(nodes.filter((n) => !n.parentId && !n.isCentral).length)} />
            <Row label="Edges aktif (UP)" value={String(nodes.filter((n) => n.parentId && n.status === "up").length)} />
            <Row label="Edges terputus (DOWN)" value={String(nodes.filter((n) => n.parentId && n.status === "down").length)} />
            <div className="pt-2 mt-2 border-t border-border/30 text-[10px] text-muted-foreground/70">
              Drag-drop untuk atur posisi. Pakai mode <span className="text-orange-400">Tambah Edge</span> untuk konek estafet.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function NodeBox({
  node,
  selected,
  edgeSource,
  onMouseDown,
}: {
  node: TopologyNode
  selected: boolean
  edgeSource: boolean
  onMouseDown: (e: React.MouseEvent) => void
}) {
  const w = node.isCentral ? 140 : 110
  const h = node.isCentral ? 60 : 44
  const isDown = node.status === "down"

  let fill = "rgba(148,163,184,0.12)"
  let stroke = "#64748b"
  if (node.isCentral) {
    fill = "rgba(251,146,60,0.2)"
    stroke = "#fb923c"
  } else if (node.status === "up") {
    fill = "rgba(74,225,118,0.15)"
    stroke = "#4ae176"
  } else if (isDown) {
    fill = "rgba(255,180,171,0.15)"
    stroke = "#ffb4ab"
  }

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: "move", userSelect: "none" }}
      onMouseDown={onMouseDown}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={node.isCentral ? 3 : selected || edgeSource ? 2.5 : 1.5}
        strokeDasharray={edgeSource ? "5 3" : undefined}
      />
      {selected && (
        <rect
          x={-w / 2 - 4}
          y={-h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={10}
          fill="none"
          stroke="#fb923c"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      )}
      <text
        textAnchor="middle"
        y={-2}
        fontSize={11}
        fontWeight={600}
        fill="#fff"
        style={{ pointerEvents: "none" }}
      >
        {node.isCentral ? "⭐ " : isDown ? "📡 " : "📶 "}
        {truncate(node.label || node.host, 16)}
      </text>
      <text
        textAnchor="middle"
        y={13}
        fontSize={9}
        fill="#94a3b8"
        style={{ pointerEvents: "none" }}
      >
        {node.host}
        {isDown ? " · DOWN" : ""}
        {node.isCentral ? " · GATEWAY" : ""}
      </text>
    </g>
  )
}

function ModeBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5 border",
        active
          ? "bg-orange-400/20 border-orange-400/50 text-orange-400"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SummaryCard({
  label, value, color, icon, small,
}: { label: string; value: string; color?: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className="card-glass rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <p className={cn(small ? "text-base" : "text-2xl", "font-headline font-bold", color || "text-foreground")}>
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}
