import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getVoucherBatch } from "@/lib/services/reseller.service"

function generateVoucherHTML(
  vouchers: { username: string; password: string }[],
  profile: string,
  createdAt: string | Date,
) {
  const date = new Date(createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const cards = vouchers
    .map(
      (v) => `
    <div class="card">
      <div class="brand">MikroTik Hotspot</div>
      <div class="divider"></div>
      <div class="field">
        <span class="label">Username</span>
        <span class="value">${v.username}</span>
      </div>
      <div class="field">
        <span class="label">Password</span>
        <span class="value">${v.password}</span>
      </div>
      <div class="divider"></div>
      <div class="meta">
        <span>${profile}</span>
        <span>${date}</span>
      </div>
    </div>`,
    )
    .join("\n")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Voucher - ${profile}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 20px;
      max-width: 210mm;
      margin: 0 auto;
    }
    .card {
      border: 2px solid #0891b2;
      border-radius: 10px;
      padding: 14px 16px;
      page-break-inside: avoid;
    }
    .brand {
      font-size: 13px;
      font-weight: 700;
      color: #0891b2;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 8px 0;
    }
    .field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .value {
      font-size: 18px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      color: #0f172a;
      letter-spacing: 2px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { margin: 0; }
      .grid { padding: 10px; gap: 8px; }
      .card { border-width: 1.5px; }
    }
  </style>
</head>
<body>
  <div class="grid">
    ${cards}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { batchId } = await params

  try {
    const batch = await getVoucherBatch(batchId, session.user.id)
    if (!batch) {
      return Response.json(
        { error: "Voucher batch not found" },
        { status: 404 },
      )
    }

    const vouchers = batch.vouchers as { username: string; password: string }[]
    const html = generateVoucherHTML(vouchers, batch.profile, batch.createdAt)

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("Failed to generate voucher PDF:", error)
    return Response.json(
      { error: "Failed to generate voucher PDF" },
      { status: 500 },
    )
  }
}
