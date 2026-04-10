"use client"

import { useState, useMemo } from "react"
import {
  MessageSquare,
  Send,
  Users,
  User,
  Loader2,
  FileText,
  AlertTriangle,
  Tag,
  CheckSquare,
  Square,
} from "lucide-react"
import { useSendTelegram } from "@/hooks/use-telegram"
import { useResellers } from "@/hooks/use-resellers"
import { toast } from "sonner"

type RecipientMode = "single" | "broadcast"

interface Reseller {
  id: string
  name: string
  telegramId: string
  phone?: string
  status?: string
}

const MESSAGE_TEMPLATES = [
  {
    label: "Status Voucher",
    icon: FileText,
    content:
      "Halo! Berikut update status voucher Anda:\n\n- Voucher aktif: [jumlah]\n- Voucher terpakai: [jumlah]\n- Voucher tersisa: [jumlah]\n\nSilakan hubungi kami jika ada pertanyaan.",
  },
  {
    label: "Gangguan Jaringan",
    icon: AlertTriangle,
    content:
      "PEMBERITAHUAN\n\nSedang terjadi gangguan jaringan di area [lokasi].\n\nEstimasi perbaikan: [waktu]\n\nMohon maaf atas ketidaknyamanannya. Kami sedang berupaya menyelesaikan masalah ini secepat mungkin.",
  },
  {
    label: "Info Promo",
    icon: Tag,
    content:
      "PROMO SPESIAL!\n\nDapatkan diskon [persentase]% untuk pembelian voucher paket [nama paket].\n\nPromo berlaku: [tanggal mulai] - [tanggal selesai]\n\nHubungi kami untuk info lebih lanjut!",
  },
]

const MAX_CHARS = 4000

export default function CommunicationPage() {
  const [mode, setMode] = useState<RecipientMode>("single")
  const [selectedResellerId, setSelectedResellerId] = useState("")
  const [customChatId, setCustomChatId] = useState("")
  const [selectedBroadcastIds, setSelectedBroadcastIds] = useState<string[]>([])
  const [message, setMessage] = useState("")

  const { data: resellers, isLoading: resellersLoading } = useResellers()
  const sendMutation = useSendTelegram()

  const resellerList: Reseller[] = useMemo(() => {
    if (!resellers || !Array.isArray(resellers)) return []
    return resellers.filter((r: Reseller) => r.telegramId)
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
    message.length <= MAX_CHARS &&
    getRecipientChatIds().length > 0

  const handleSend = () => {
    const chatIds = getRecipientChatIds()
    if (chatIds.length === 0 || !message.trim()) return

    if (chatIds.length === 1) {
      sendMutation.mutate(
        { chatId: chatIds[0], message: message.trim() },
        {
          onSuccess: () => {
            toast.success("Pesan terkirim ke 1 penerima")
            setMessage("")
          },
          onError: (err) => {
            toast.error(err.message || "Gagal mengirim pesan")
          },
        }
      )
    } else {
      sendMutation.mutate(
        { chatIds, message: message.trim() },
        {
          onSuccess: () => {
            toast.success(`Pesan terkirim ke ${chatIds.length} penerima`)
            setMessage("")
          },
          onError: (err) => {
            toast.error(err.message || "Gagal mengirim pesan")
          },
        }
      )
    }
  }

  const applyTemplate = (content: string) => {
    setMessage(content)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-[#4cd7f6]" />
          <h1 className="text-4xl font-headline font-bold text-[#dae2fd]">
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
            {/* Recipient mode toggle */}
            <div className="mb-6">
              <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                Recipient Type
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setMode("single")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer ${
                    mode === "single"
                      ? "bg-[#06b6d4] text-[#00424f]"
                      : "bg-[#2d3449] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <User className="h-4 w-4" />
                  Single Recipient
                </button>
                <button
                  onClick={() => setMode("broadcast")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer ${
                    mode === "broadcast"
                      ? "bg-[#06b6d4] text-[#00424f]"
                      : "bg-[#2d3449] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Broadcast All Resellers
                </button>
              </div>
            </div>

            {/* Recipient selector */}
            <div className="mb-6">
              <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                {mode === "single" ? "Select Recipient" : "Select Resellers"}
              </label>

              {mode === "single" ? (
                <div className="space-y-3">
                  {/* Reseller dropdown */}
                  <select
                    value={selectedResellerId}
                    onChange={(e) => {
                      setSelectedResellerId(e.target.value)
                      if (e.target.value) setCustomChatId("")
                    }}
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd] focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40 appearance-none cursor-pointer"
                  >
                    <option value="">-- Select a reseller --</option>
                    {resellersLoading && (
                      <option disabled>Loading...</option>
                    )}
                    {resellerList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.telegramId})
                      </option>
                    ))}
                  </select>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                      or
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Custom Chat ID */}
                  <input
                    type="text"
                    value={customChatId}
                    onChange={(e) => {
                      setCustomChatId(e.target.value)
                      if (e.target.value) setSelectedResellerId("")
                    }}
                    placeholder="Enter custom Telegram Chat ID"
                    className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Select All toggle */}
                  <button
                    onClick={selectAllBroadcast}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-headline font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {selectedBroadcastIds.length === resellerList.length &&
                    resellerList.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-[#4cd7f6]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Select All ({resellerList.length})
                  </button>

                  {/* Reseller checklist */}
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {resellersLoading ? (
                      <div className="flex items-center gap-2 py-4 justify-center text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading resellers...</span>
                      </div>
                    ) : resellerList.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">
                        No resellers with Telegram ID found
                      </p>
                    ) : (
                      resellerList.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => toggleBroadcastId(r.id)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-[#2d3449]/60 transition-colors text-left cursor-pointer"
                        >
                          {selectedBroadcastIds.includes(r.id) ? (
                            <CheckSquare className="h-4 w-4 text-[#4cd7f6] flex-shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[#dae2fd] font-medium truncate block">
                              {r.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono-tech">
                              ID: {r.telegramId}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Message textarea */}
            <div className="mb-6">
              <label className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setMessage(e.target.value)
                  }
                }}
                placeholder="Ketik pesan Anda..."
                rows={8}
                className="w-full bg-[#2d3449] border-none rounded-lg py-3 px-4 text-sm text-[#dae2fd] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4cd7f6]/40 resize-none"
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-[10px] font-mono-tech ${
                    message.length > MAX_CHARS * 0.9
                      ? "text-amber-400"
                      : "text-slate-500"
                  }`}
                >
                  {message.length} / {MAX_CHARS}
                </span>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend || sendMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-headline font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-[#06b6d4] hover:bg-[#4cd7f6] text-[#00424f]"
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
                  onClick={() => applyTemplate(template.content)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-[#2d3449]/50 hover:bg-[#2d3449] border border-white/5 hover:border-[#4cd7f6]/20 transition-all duration-200 text-left cursor-pointer group"
                >
                  <div className="p-2 rounded-lg bg-[#4cd7f6]/10 group-hover:bg-[#4cd7f6]/20 transition-colors">
                    <template.icon className="h-4 w-4 text-[#4cd7f6]" />
                  </div>
                  <div>
                    <span className="text-sm text-[#dae2fd] font-medium block">
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
            <div className="mt-6 pt-4 border-t border-white/5">
              <h3 className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest mb-3">
                Send Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Mode</span>
                  <span className="text-[#dae2fd] font-medium">
                    {mode === "single" ? "Single" : "Broadcast"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Recipients</span>
                  <span className="text-[#4cd7f6] font-bold">
                    {getRecipientChatIds().length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Message length</span>
                  <span className="text-[#dae2fd] font-mono-tech">
                    {message.length}
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
