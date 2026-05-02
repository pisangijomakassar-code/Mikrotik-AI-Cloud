import crypto from "crypto"

const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true"

export const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ""

export const SNAP_SCRIPT_URL = IS_PROD
  ? "https://app.midtrans.com/snap/snap.js"
  : "https://app.sandbox.midtrans.com/snap/snap.js"

const SNAP_API_URL = IS_PROD
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions"

function authHeader(): string {
  const key = process.env.MIDTRANS_SERVER_KEY ?? ""
  return "Basic " + Buffer.from(key + ":").toString("base64")
}

export async function createSnapToken(params: {
  orderId: string
  grossAmount: number
  customerEmail: string
  itemName: string
}): Promise<{ token: string; redirect_url: string }> {
  const res = await fetch(SNAP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      customer_details: { email: params.customerEmail },
      item_details: [
        {
          id: params.orderId,
          price: params.grossAmount,
          quantity: 1,
          name: params.itemName,
        },
      ],
      enabled_payments: ["qris"],
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Midtrans Snap error ${res.status}: ${err}`)
  }
  return res.json()
}

export function computeSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string
): string {
  const key = process.env.MIDTRANS_SERVER_KEY ?? ""
  return crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + key)
    .digest("hex")
}
