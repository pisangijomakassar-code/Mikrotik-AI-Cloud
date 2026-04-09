"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/hooks/use-chat"

function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeLines: string[] = []
  let codeKey = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${codeKey++}`}
            className="my-2 overflow-x-auto rounded-md bg-black/30 p-3 font-mono text-xs leading-relaxed text-emerald-300"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        )
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, "")
      elements.push(
        <div key={i} className="flex gap-2 pl-2">
          <span className="text-primary">-</span>
          <span>{formatInline(content)}</span>
        </div>
      )
      continue
    }

    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    elements.push(
      <p key={i} className="leading-relaxed">
        {formatInline(line)}
      </p>
    )
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key={`code-${codeKey}`}
        className="my-2 overflow-x-auto rounded-md bg-black/30 p-3 font-mono text-xs leading-relaxed text-emerald-300"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>
    )
  }

  return elements
}

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-primary"
        >
          {match[3]}
        </code>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [imageExpanded, setImageExpanded] = useState(false)
  const isUser = message.role === "user"

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      <div
        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "relative max-w-[75%] rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-slate-700/60 text-foreground backdrop-blur-sm"
              : "border-l-2 border-primary bg-card/80 text-foreground backdrop-blur-sm"
          )}
        >
          {message.imageUrl && (
            <button
              type="button"
              onClick={() => setImageExpanded(true)}
              className="mb-2 block overflow-hidden rounded-lg"
            >
              <img
                src={message.imageUrl}
                alt="Attached"
                className="max-h-48 max-w-full rounded-lg object-cover transition-transform hover:scale-[1.02]"
              />
            </button>
          )}

          {message.content && (
            <div className="space-y-0.5">
              {isUser ? (
                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
              ) : (
                formatMarkdown(message.content)
              )}
            </div>
          )}

          <p
            className={cn(
              "mt-1.5 text-[10px]",
              isUser ? "text-right text-slate-400" : "text-muted-foreground"
            )}
          >
            {time}
          </p>
        </div>
      </div>

      {imageExpanded && message.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setImageExpanded(false)}
        >
          <img
            src={message.imageUrl}
            alt="Expanded"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  )
}
