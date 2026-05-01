"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  MessageSquare,
  Send,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react"
import { useSendTelegram } from "@/hooks/use-telegram"
import { useResellers } from "@/hooks/use-resellers"
import { useActiveRouter } from "@/components/active-router-context"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { MESSAGE_TEMPLATES, MAX_MESSAGE_CHARS } from "@/lib/constants/message-templates"
import {
  RecipientSelector,
  type RecipientMode,
  type Reseller,
} from "@/components/communication/recipient-selector"

export default function CommunicationPage() {
  const [planData, setPlanData] = useState<{ plan: string } | null>(null)
  const [planLoading, setPlanLoading] = useState(true)

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subscription) setPlanData({ plan: data.subscription.plan })
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false))
  }, [])

  const [mode, setMode] = useState<RecipientMode>("single")
  const [selectedResellerId, setSelectedResellerId] = useState("")
  const [customChatId, setCustomChatId] = useState("")
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhoto(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    } else {
      setPhotoPreview(null)
    }
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const { activeRouter } = useActiveRouter()
  const { data: resellers, isLoading: resellersLoading } = useResellers(activeRouter || undefined)
  const sendMutation = useSendTelegram()

  const resellerList: Reseller[] = useMemo(() => {
    if (!resellers || !Array.isArray(resellers)) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resellers.filter((r: any) => r.telegramId) as Reseller[]
  }, [resellers])

  const selectedReseller = resellerList.find(
    (r) => r.id === selectedResellerId
  )

  const toggleBroadcastId = (id: string) => {
    setSelectedBroadcastIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllBroadcast = () => {
    if (selectedBroadcastIds.length === resellerList.length) {
      setSelectedBroadcastIds([])
    } else {
      setSelectedBroadcastIds(resellerList.map((r) => r.id))
    }
  }

  const getRecipientChatIds = (): string[] => {
    if (mode === "single") {
      if (selectedReseller) return [selectedReseller.telegramId]
      if (customChatId.trim()) return [customChatId.trim()]
      return []
    }
    return selectedBroadcastIds
      .map((id) => resellerList.find((r) => r.id === id)?.telegramId)
      .filter(Boolean) as string[]
  }

  const canSend =
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_CHARS &&
    getRecipientChatIds().length > 0

  const handleSend = () => {
    const chatIds = getRecipientChatIds()
    if (chatIds.length === 0 || !message.trim()) return

    const payload = chatIds.length === 1
      ? { chatId: chatIds[0], message: message.trim(), photo }
      : { chatIds, message: message.trim(), photo }

    sendMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`Pesan terkirim ke ${chatIds.length} penerima`)
        setMessage("")
        removePhoto()
      },
      onError: (err) => {
        toast.error(err.message || "Gagal mengirim pesan")
      },
    })
  }

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  if (planData?.plan !== "PREMIUM") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <MessageSquare className="h-16 w-16 text-slate-600" />
        <h2 className="text-2xl font-headline font-bold text-foreground">Premium Feature</h2>
        <p className="text-slate-400 text-center max-w-md">
          Communication panel tersedia hanya untuk plan Premium. Upgrade untuk mengirim pesan ke reseller via Telegram.
        </p>
        <a
          href="/plan"
          className="px-6 py-3 rounded-lg text-sm font-bold bg-linear-to-r from-primary to-primary-container text-primary-foreground hover:brightness-110 transition-all"
        >
          Upgrade ke Premium
        </a>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-headline font-bold text-foreground">
            Communication
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Send messages to resellers and users via Telegram
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main form card */}
        <div className="col-span-12 lg:col-span-8">
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <RecipientSelector
              mode={mode}
              onModeChange={setMode}
              resellerList={resellerList}
              resellersLoading={resellersLoading}
              selectedResellerId={selectedResellerId}
              onResellerChange={setSelectedResellerId}
              customChatId={customChatId}
              onCustomChatIdChange={setCustomChatId}
              selectedBroadcastIds={selectedBroadcastIds}
              onToggleBroadcastId={toggleBroadcastId}
              onSelectAllBroadcast={selectAllBroadcast}
            />

            {/* Photo upload */}
            <div className="mb-5">
              <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                Foto (opsional)
              </label>
              {photoPreview ? (
                <div className="relative w-fit">
                  <img src={photoPreview} alt="preview" className="max-h-40 rounded-xl border border-white/10 object-cover" />
                  <button
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-primary-foreground flex items-center justify-center hover:brightness-110 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 text-slate-400 hover:border-primary/50 hover:text-primary text-sm transition-all"
                >
                  <ImagePlus className="h-4 w-4" />
                  Pilih Foto
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Message textarea */}
            <div className="mb-6">
              <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                {photo ? "Caption" : "Message"}
              </label>
              <Textarea
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_MESSAGE_CHARS) {
                    setMessage(e.target.value)
                  }
                }}
                placeholder="Ketik pesan Anda..."
                rows={8}
                className="w-full bg-surface-highest border-none rounded-lg py-3 px-4 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40 resize-none"
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-[10px] font-mono-tech ${
                    message.length > MAX_MESSAGE_CHARS * 0.9
                      ? "text-amber-400"
                      : "text-slate-500"
                  }`}
                >
                  {message.length} / {MAX_MESSAGE_CHARS}
                </span>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend || sendMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary-container hover:bg-primary text-primary-foreground"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendMutation.isPending
                ? "Mengirim..."
                : `Kirim Pesan${
                    getRecipientChatIds().length > 1
                      ? ` (${getRecipientChatIds().length} penerima)`
                      : ""
                  }`}
            </button>
          </div>
        </div>

        {/* Templates sidebar */}
        <div className="col-span-12 lg:col-span-4">
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h3 className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-4">
              Quick Templates
            </h3>

            <div className="space-y-3">
              {MESSAGE_TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  onClick={() => setMessage(template.content)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-surface-highest/50 hover:bg-surface-highest border border-border/20 hover:border-primary/20 transition-all duration-200 text-left cursor-pointer group"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <template.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm text-foreground font-medium block">
                      {template.label}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">
                      {template.content.slice(0, 50)}...
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Recipient summary */}
            <div className="mt-6 pt-4 border-t border-border/20">
              <h3 className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3">
                Send Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Mode</span>
                  <span className="text-foreground font-medium">
                    {mode === "single" ? "Single" : "Broadcast"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Recipients</span>
                  <span className="text-primary font-bold">
                    {getRecipientChatIds().length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Message length</span>
                  <span className="text-foreground font-mono-tech">
                    {message.length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Foto</span>
                  <span className={photo ? "text-tertiary font-bold" : "text-slate-500"}>
                    {photo ? photo.name.slice(0, 16) + (photo.name.length > 16 ? "…" : "") : "Tidak ada"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
