"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { BookOpen, FileCode, ShieldCheck, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const DOCS = [
  { slug: "user-guide", label: "User Guide", icon: BookOpen },
  { slug: "api-reference", label: "API Reference", icon: FileCode },
  { slug: "admin-guide", label: "Admin Guide", icon: ShieldCheck },
] as const

type DocSlug = (typeof DOCS)[number]["slug"]

export default function DocsPage() {
  const [contents, setContents] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<DocSlug>("user-guide")

  async function fetchDoc(slug: DocSlug) {
    if (contents[slug]) return
    setLoading((p) => ({ ...p, [slug]: true }))
    try {
      const res = await fetch(`/api/docs/${slug}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setContents((p) => ({ ...p, [slug]: data.content }))
    } catch {
      setContents((p) => ({ ...p, [slug]: "Failed to load documentation." }))
    } finally {
      setLoading((p) => ({ ...p, [slug]: false }))
    }
  }

  useEffect(() => {
    fetchDoc("user-guide")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function filterContent(content: string) {
    if (!search.trim()) return content
    return content
  }

  function highlightCount(content: string): number {
    if (!search.trim()) return 0
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    return (content.match(regex) || []).length
  }

  return (
    <div>
      {/* Header */}
      <header className="mb-10">
        <h2 className="text-4xl font-bold tracking-tight text-[#dae2fd] font-headline">
          Documentation
        </h2>
        <p className="text-slate-400 mt-2 font-medium">
          Guides, API reference, and administration docs for MikroTik AI Agent.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search documentation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#131b2e] border border-white/5 rounded-xl text-sm text-[#dae2fd] placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#4cd7f6]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tabs - same style as user page */}
      <div className="flex items-center gap-4 bg-[#131b2e] p-1.5 rounded-lg border border-white/5 w-fit">
        {DOCS.map((doc) => {
          const count = contents[doc.slug] ? highlightCount(contents[doc.slug]) : 0
          return (
            <button
              key={doc.slug}
              type="button"
              onClick={() => { setActiveTab(doc.slug); fetchDoc(doc.slug) }}
              className={cn(
                "flex items-center gap-2 px-5 py-1.5 font-bold text-xs rounded-lg transition-colors",
                activeTab === doc.slug
                  ? "bg-[#222a3d] text-[#4cd7f6]"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <doc.icon className="h-4 w-4" />
              {doc.label}
              {search && count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-[#4cd7f6]/20 text-[#4cd7f6] text-[10px] rounded-full font-bold">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {DOCS.map((doc) => (
        activeTab === doc.slug && (
          <div key={doc.slug} className="mt-6">
            {loading[doc.slug] ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 text-[#4cd7f6] animate-spin" />
              </div>
            ) : contents[doc.slug] ? (
              <article className="bg-[#131b2e] rounded-xl border border-white/5 p-8 md:p-12 overflow-auto max-h-[calc(100vh-320px)]">
                <div className="prose prose-invert prose-cyan max-w-none
                  prose-headings:font-headline prose-headings:text-[#dae2fd]
                  prose-h1:text-3xl prose-h1:border-b prose-h1:border-white/5 prose-h1:pb-4 prose-h1:mb-8
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                  prose-h3:text-lg prose-h3:text-cyan-400
                  prose-p:text-slate-300 prose-p:leading-relaxed
                  prose-a:text-[#4cd7f6] prose-a:no-underline hover:prose-a:underline
                  prose-code:text-[#4cd7f6] prose-code:bg-[#0b1326] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                  prose-pre:bg-[#0b1326] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-xl
                  prose-strong:text-[#dae2fd]
                  prose-li:text-slate-300 prose-li:marker:text-cyan-800
                  prose-table:border-collapse
                  prose-th:bg-[#0b1326] prose-th:text-[#dae2fd] prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:tracking-widest prose-th:font-bold
                  prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-white/5 prose-td:text-slate-300
                  prose-hr:border-white/5
                  prose-blockquote:border-l-[#4cd7f6] prose-blockquote:bg-[#0b1326]/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
                ">
                  <MarkdownWithHighlight content={filterContent(contents[doc.slug])} search={search} />
                </div>
              </article>
            ) : null}
          </div>
        )
      ))}
    </div>
  )
}

function MarkdownWithHighlight({ content, search }: { content: string; search: string }) {
  if (!search.trim()) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        text: ({ children }) => {
          if (typeof children !== "string") return <>{children}</>
          return <HighlightText text={children} search={search} />
        },
        p: ({ children, ...props }) => (
          <p {...props}>{highlightChildren(children, search)}</p>
        ),
        li: ({ children, ...props }) => (
          <li {...props}>{highlightChildren(children, search)}</li>
        ),
        td: ({ children, ...props }) => (
          <td {...props}>{highlightChildren(children, search)}</td>
        ),
        th: ({ children, ...props }) => (
          <th {...props}>{highlightChildren(children, search)}</th>
        ),
      }}
    >{content}</ReactMarkdown>
  )
}

function highlightChildren(children: React.ReactNode, search: string): React.ReactNode {
  if (!children) return children
  if (typeof children === "string") {
    return <HighlightText text={children} search={search} />
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return <HighlightText key={i} text={child} search={search} />
      }
      return child
    })
  }
  return children
}

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-[#4cd7f6]/25 text-[#4cd7f6] rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}
