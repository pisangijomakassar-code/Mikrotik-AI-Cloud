"use client"

import { useState } from "react"
import { Sparkles, Brain, RefreshCw } from "lucide-react"
import { useAIInsight } from "@/hooks/use-ai-insight"

export function DashboardAIInsight() {
  const { mutate, isPending, data, error } = useAIInsight()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const handleGenerate = () => {
    mutate(undefined, {
      onSuccess: () => {
        setLastUpdated(new Date())
      },
    })
  }

  // Render insight text with basic formatting (line breaks + bold)
  const renderInsight = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold text between ** **
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <p key={i} className={line.trim() === "" ? "h-3" : "text-sm text-slate-300 leading-relaxed"}>
          {parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <span key={j} className="font-bold text-[#dae2fd]">
                  {part.slice(2, -2)}
                </span>
              )
            }
            return <span key={j}>{part}</span>
          })}
        </p>
      )
    })
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#4cd7f6]" />
          <h3 className="text-sm font-headline font-bold text-[#dae2fd] uppercase tracking-widest">
            AI Network Insight
          </h3>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold font-headline transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#00424f]"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isPending ? "Generating..." : "Generate Insight"}
        </button>
      </div>

      {isPending && (
        <div className="space-y-3 animate-pulse py-4">
          <div className="h-4 w-full rounded bg-[#222a3d]" />
          <div className="h-4 w-5/6 rounded bg-[#222a3d]" />
          <div className="h-4 w-4/6 rounded bg-[#222a3d]" />
          <div className="h-4 w-3/4 rounded bg-[#222a3d]" />
        </div>
      )}

      {!isPending && error && (
        <div className="py-4 px-4 rounded-xl bg-[#ffb4ab]/5 border border-[#ffb4ab]/10">
          <p className="text-sm text-[#ffb4ab]">
            Failed to generate insight. Please try again.
          </p>
        </div>
      )}

      {!isPending && data && (
        <div className="space-y-1 py-2">
          <div className="p-4 rounded-xl bg-[#131b2e] border border-white/5">
            <div className="space-y-1">
              {renderInsight(data.insight || data.response || JSON.stringify(data))}
            </div>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-slate-500 font-mono-tech pt-2">
              Last updated: {lastUpdated.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      {!isPending && !data && !error && (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Sparkles className="h-8 w-8" />
          <p className="text-xs text-slate-500">
            Click &quot;Generate Insight&quot; to get AI-powered analysis of your network
          </p>
        </div>
      )}
    </div>
  )
}
