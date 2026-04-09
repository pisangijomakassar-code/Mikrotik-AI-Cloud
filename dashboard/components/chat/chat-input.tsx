"use client"

import { useState, useRef, useCallback } from "react"
import { Paperclip, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    // Refocus textarea
    setTimeout(() => textareaRef.current?.focus(), 0)
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
        "border-t border-border bg-card/50 p-4 backdrop-blur-sm transition-colors",
        isDragOver && "border-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 flex items-start gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-16 w-16 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {imageFile?.name}
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* File upload */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Attach image"
        >
          <Paperclip className="h-4 w-4" />
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            // Auto-resize
            const ta = e.target
            ta.style.height = "auto"
            ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="min-h-[36px] flex-1 resize-none rounded-lg border border-input bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:opacity-50"
        />

        {/* Send */}
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={disabled || (!message.trim() && !imageFile)}
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/80"
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
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
