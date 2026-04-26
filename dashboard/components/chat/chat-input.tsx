"use client"

import { useState, useRef, useCallback } from "react"
import { Paperclip, Send, X, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string, image?: File) => void
  disabled?: boolean
}

const QUICK_ACTIONS = [
  { label: "Diagnose connection", icon: "monitor_heart" },
  { label: "Check logs", icon: "description" },
  { label: "Update firmware", icon: "system_update" },
  { label: "Audit Firewall", icon: "security" },
] as const

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const clearImage = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed && !imageFile) return
    onSend(trimmed, imageFile || undefined)
    setMessage("")
    clearImage()
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [message, imageFile, onSend, clearImage])

  const handleQuickAction = useCallback(
    (label: string) => {
      if (disabled) return
      onSend(label)
    },
    [disabled, onSend]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleImageSelect(file)
    },
    [handleImageSelect]
  )

  return (
    <div
      className={cn(
        "w-full p-6 transition-colors bg-linear-to-t from-background via-background to-transparent",
        isDragOver && "bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Image preview */}
      {imagePreview && (
        <div className="mx-auto mb-3 flex max-w-4xl items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-16 w-16 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-900 text-white transition-colors hover:bg-red-800"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{imageFile?.name}</span>
        </div>
      )}

      {/* Quick Actions - rounded-full pills matching Stitch */}
      <div className="mx-auto mb-4 flex max-w-4xl gap-2 overflow-x-auto pb-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            onClick={() => handleQuickAction(action.label)}
            disabled={disabled}
            className="shrink-0 whitespace-nowrap rounded-full border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Glass Card Floating Input */}
      <div className="relative mx-auto max-w-4xl">
        <div className="card-glass flex items-center rounded-2xl p-2 shadow-2xl border border-border/20">
          {/* Mic button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="h-10 w-10 shrink-0 rounded-lg text-muted-foreground hover:text-primary"
            title="Voice input"
          >
            <Mic className="h-5 w-5" />
          </Button>

          {/* Input field - using shadcn Input */}
          <Input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to configure OSPF, check routes, or monitor traffic..."
            disabled={disabled}
            className="flex-1 border-none bg-transparent px-4 text-sm text-foreground placeholder-muted-foreground shadow-none ring-0 focus-visible:border-none focus-visible:ring-0"
          />

          <div className="flex items-center gap-2 pr-2">
            {/* Attach button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageSelect(file)
              }}
            />

            {/* Send button */}
            <Button
              type="button"
              onClick={handleSend}
              disabled={disabled || (!message.trim() && !imageFile)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="mt-2 text-center text-xs text-primary">
          Drop image here
        </div>
      )}
    </div>
  )
}
