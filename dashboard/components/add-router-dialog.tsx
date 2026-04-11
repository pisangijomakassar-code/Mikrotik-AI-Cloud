"use client"

import { useState } from "react"
import { PlusCircle, X } from "lucide-react"
import { useCreateRouter } from "@/hooks/use-routers"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ── Main Component ────────────────────────────────────────────────────────────

export function AddRouterDialog() {
  const [open, setOpen] = useState(false)

  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("8728")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [label, setLabel] = useState("")
  const [isDefault, setIsDefault] = useState(false)

  const createRouter = useCreateRouter()

  function resetForm() {
    setName("")
    setHost("")
    setPort("8728")
    setUsername("")
    setPassword("")
    setLabel("")
    setIsDefault(false)
  }

  function handleClose() {
    setOpen(false)
    resetForm()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !host.trim() || !username.trim() || !password) {
      toast.error("Nama, host, username, dan password wajib diisi")
      return
    }

    createRouter.mutate(
      {
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port) || 8728,
        username: username.trim(),
        password,
        label: label.trim() || undefined,
        isDefault,
        userId: "",
      },
      {
        onSuccess: () => {
          toast.success("Router berhasil ditambahkan")
          resetForm()
          setOpen(false)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      }
    )
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-[#4cd7f6]/20 hover:scale-105 transition-all duration-200"
      >
        <PlusCircle className="h-4 w-4" />
        Provision Node
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/60 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 md:mx-0 bg-card border border-border rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 md:p-8 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-headline font-bold text-foreground">
                  Provision Node
                </h3>
                <p className="text-sm text-muted-foreground/70">
                  Tambahkan MikroTik router ke sistem manajemen.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-4 md:p-8 space-y-6">

                {/* ── Common Fields ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Nama Router
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. HQ-Core-CCR2004"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Label (Opsional)
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="e.g. Kantor Cabang"
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Host & Port ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Host / IP Address
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="192.168.88.1"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Port
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm font-mono-tech focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="8728"
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Credentials ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Username
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="admin"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                      Password
                    </label>
                    <Input
                      className="w-full bg-muted border-none rounded-lg py-3 px-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 transition-all text-foreground outline-none"
                      placeholder="Password API router"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* ── Default Toggle ── */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground">
                    Jadikan router utama (default)
                  </span>
                  <div
                    className={cn(
                      "w-10 h-5 rounded-full relative p-1 cursor-pointer transition-colors",
                      isDefault ? "bg-[#4ae176]/20" : "bg-muted-foreground/20"
                    )}
                    onClick={() => setIsDefault(!isDefault)}
                  >
                    <div
                      className={cn(
                        "absolute top-1 w-3 h-3 rounded-full transition-all",
                        isDefault
                          ? "right-1 bg-[#4ae176] shadow-[0_0_8px_rgba(74,225,118,0.5)]"
                          : "left-1 bg-muted-foreground/50"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 md:p-8 bg-muted/50 flex items-center justify-end gap-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 text-muted-foreground hover:text-foreground font-headline font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createRouter.isPending}
                  className="bg-linear-to-br from-[#4cd7f6] to-[#06b6d4] text-[#003640] font-headline font-bold px-8 py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
                >
                  {createRouter.isPending ? "Menambahkan..." : "Tambah Router"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
