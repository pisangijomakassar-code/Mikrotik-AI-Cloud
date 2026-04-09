"use client"

import { useState, useRef, useCallback } from "react"
import { Paperclip, Send, X, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string, image?: File) => void
  disabled?: boolean
}

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
        "p-6 transition-colors",
        isDragOver && "bg-[#06b6d4]/5"
      )}
      style={{
        background: "linear-gradient(to top, rgba(15, 23, 42, 1), rgba(15, 23, 42, 1), transparent)",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 flex items-start gap-2 max-w-4xl mx-auto">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-16 w-16 rounded-lg border border-white/10 object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#93000a] text-white transition-colors hover:bg-[#93000a]/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {imageFile?.name}
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 max-w-4xl mx-auto">
        {[
          { label: "Diagnose connection", icon: "monitor_heart" },
          { label: "Check logs", icon: "description" },
          { label: "Update firmware", icon: "system_update" },
          { label: "Audit Firewall", icon: "security" },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              setMessage(action.label)
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            disabled={disabled}
            className="whitespace-nowrap px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-[#06b6d4]/10 hover:border-[#06b6d4]/50 transition-all text-xs text-slate-400 hover:text-[#4cd7f6] disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Glass Card Input */}
      <div className="relative max-w-4xl mx-auto">
        <div
          className="flex items-center p-2 rounded-2xl shadow-2xl border border-white/20"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button
            type="button"
            disabled={disabled}
            className="p-3 text-slate-400 hover:text-[#4cd7f6] transition-colors rounded-lg disabled:opacity-50"
            title="Voice input"
          >
            <Mic className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to configure OSPF, check routes, or monitor traffic..."
            disabled={disabled}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-100 placeholder-slate-500 px-4 outline-none disabled:opacity-50"
          />
          <div className="flex items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg disabled:opacity-50"
              title="Attach image"
            >
              <Paperclip className="h-5 w-5" />
            </button>
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
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || (!message.trim() && !imageFile)}
              className="bg-[#06b6d4] text-slate-950 p-3 rounded-lg hover:bg-[#4cd7f6] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="mt-2 text-center text-xs text-[#4cd7f6]">
          Drop image here
        </div>
      )}
    </div>
  )
}
