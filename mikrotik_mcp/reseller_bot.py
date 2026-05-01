"""
Lightweight Telegram bot for resellers -- button-based, no LLM.

Each ISP owner (User) can configure a ``resellerBotToken`` in the database.
This module queries all users that have a token set and starts a separate
python-telegram-bot Application per token.  Each Application handles the
reseller flow (check saldo, buy vouchers, request deposit, history) via
InlineKeyboardButtons.

Start via:
    python3 mikrotik_mcp/reseller_bot.py        # standalone
    OR import start_reseller_bots() from another module
"""

import asyncio
import logging
import json
import os
import random
import string
import sys
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Graceful import of python-telegram-bot (v20+)
# ---------------------------------------------------------------------------
try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
    from telegram.ext import (
        Application, CommandHandler, CallbackQueryHandler, ContextTypes,
        MessageHandler, filters,
    )
    _PTB_AVAILABLE = True
except ImportError:
    _PTB_AVAILABLE = False
    logger.warning(
        "python-telegram-bot not installed -- reseller bot will NOT start. "
        "Install with: pip install python-telegram-bot"
    )

# ---------------------------------------------------------------------------
# Internal imports (work both as package and standalone)
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))

try:
    from mikrotik_mcp.voucher_db import VoucherDB
except ModuleNotFoundError:
    from voucher_db import VoucherDB

try:
    from mikrotik_mcp.server import connect_router, registry as _registry
except ModuleNotFoundError:
    try:
        from server import connect_router, registry as _registry
    except Exception:
        _registry = None

        @contextmanager
        def connect_router(host, port, username, password, retries=2):
            """Fallback stub -- should never be reached in production."""
            raise RuntimeError("server.py not importable")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def format_rp(amount: int) -> str:
    """Format integer as Indonesian Rupiah string."""
    return f"Rp {amount:,.0f}".replace(",", ".")


BOT_TEXT_DEFAULTS = {
    "bot_text_welcome": "Halo {name}! Saldo: {saldo}",
    "bot_text_not_registered": "Anda belum terdaftar. Hubungi admin untuk didaftarkan.",
    "bot_text_saldo": "Saldo Anda: {saldo}",
    "bot_text_buy_confirm": "Konfirmasi beli voucher {nama}?\nHarga: {harga}\nSaldo setelah: {saldo_setelah}",
    "bot_text_buy_success": "✅ Voucher berhasil dibeli!\nUsername: {username}\nPassword: {password}\nSisa saldo: {saldo}",
    "bot_text_deposit_info": "Pilih nominal deposit:",
    "bot_text_deposit_req": "Permintaan deposit {nominal} telah dikirim ke admin.",
    "bot_text_deposit_sent": "✅ Deposit {nominal} berhasil dikonfirmasi. Saldo baru: {saldo}",
}


def _get_bot_texts() -> dict:
    """Load custom bot texts from SystemSetting, falling back to defaults."""
    if not DATABASE_URL:
        return BOT_TEXT_DEFAULTS.copy()
    import psycopg2
    import psycopg2.extras
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            'SELECT key, value FROM "SystemSetting" WHERE key LIKE \'bot_text_%\''
        )
        rows = {r["key"]: r["value"] for r in cur.fetchall()}
        cur.close()
        conn.close()
        result = BOT_TEXT_DEFAULTS.copy()
        result.update(rows)
        return result
    except Exception as exc:
        logger.warning("Failed to load bot texts from DB, using defaults: %s", exc)
        return BOT_TEXT_DEFAULTS.copy()


def _get_users_with_bot_token() -> list[dict]:
    """Query all User rows that have a non-null resellerBotToken."""
    if not DATABASE_URL:
        return []
    import psycopg2
    import psycopg2.extras
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            'SELECT "id", "telegramId", "resellerBotToken" '
            'FROM "User" '
            'WHERE "resellerBotToken" IS NOT NULL AND "resellerBotToken" != \'\''
        )
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as exc:
        logger.error("Failed to query users with resellerBotToken: %s", exc)
        return []


def _get_registry():
    """Return the active router registry singleton."""
    if _registry is not None:
        return _registry
    # Fallback: build one ourselves
    if DATABASE_URL:
        try:
            from mikrotik_mcp.registry_pg import RouterRegistryPG
        except ModuleNotFoundError:
            from registry_pg import RouterRegistryPG
        return RouterRegistryPG(database_url=DATABASE_URL)
    raise RuntimeError("No registry available (no DATABASE_URL)")


# ---------------------------------------------------------------------------
# ResellerBot -- one instance per ISP owner
# ---------------------------------------------------------------------------

class ResellerBot:
    """One bot instance per ISP owner (User)."""

    def __init__(self, bot_token: str, owner_telegram_id: str, vdb: VoucherDB):
        self.bot_token = bot_token
        self.owner_telegram_id = owner_telegram_id
        self.vdb = vdb
        self.texts = _get_bot_texts()
        # In-memory pending deposit requests (dep_id → {reseller_id, amount, photo_file_id, ...})
        # Note: lost on bot restart — for production-grade, simpan ke DB sebagai SaldoTransaction
        # dengan flag PENDING. Untuk v1 in-memory cukup karena owner approve/reject biasanya cepat.
        self._pending_deposits: dict[str, dict] = {}

    def t(self, key: str, **kwargs) -> str:
        """Get bot text for key, formatted with kwargs."""
        tmpl = self.texts.get(key, BOT_TEXT_DEFAULTS.get(key, key))
        try:
            return tmpl.format(**kwargs)
        except KeyError:
            return tmpl

    # ── Keyboard helpers ──────────────────────────────────────

    @staticmethod
    def _main_menu_keyboard() -> InlineKeyboardMarkup:
        return InlineKeyboardMarkup([
            [
                InlineKeyboardButton("💰 Cek Saldo", callback_data="saldo"),
                InlineKeyboardButton("🎫 Beli Voucher", callback_data="buy"),
            ],
            [
                InlineKeyboardButton("💳 Request Deposit", callback_data="deposit"),
                InlineKeyboardButton("📋 History", callback_data="history"),
            ],
        ])

    @staticmethod
    def _back_button() -> InlineKeyboardMarkup:
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")],
        ])

    # ── /start ────────────────────────────────────────────────

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        telegram_id = str(update.effective_user.id)

        # OWNER: tampil menu admin + inline button utk command yg sering dipakai
        if self._is_owner(telegram_id):
            await update.message.reply_text(
                "👋 *Halo Admin*\n\n"
                "Tap salah satu tombol di bawah, atau ketik tombol /  di kolom chat\n"
                "untuk lihat semua command.\n\n"
                "🤖 AI\n"
                "/ai — chat dengan AI Assistant (auto-stop 10mnt idle)\n"
                "/stopai — akhiri sesi AI\n\n"
                "📊 Monitoring\n"
                "/report — penjualan hari ini & bulan ini\n"
                "/resource — resource MikroTik\n"
                "/netwatch — status host monitoring\n\n"
                "💰 Saldo Reseller\n"
                "/topup — wizard top up saldo reseller\n"
                "/topdown — wizard kurangi saldo reseller\n\n"
                "📢 Komunikasi\n"
                "/broadcast <pesan> — kirim pengumuman ke semua reseller\n\n"
                "🎫 Voucher\n"
                "/cek <username> — status hotspot user\n"
                "/qrcode <user> [pwd] — generate QR voucher",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("🤖 AI Chat", callback_data="adm_ai"),
                     InlineKeyboardButton("📊 Report", callback_data="adm_report")],
                    [InlineKeyboardButton("🖥 Resource", callback_data="adm_resource"),
                     InlineKeyboardButton("📡 Netwatch", callback_data="adm_netwatch")],
                    [InlineKeyboardButton("💰 Top Up", callback_data="adm_topup"),
                     InlineKeyboardButton("➖ Top Down", callback_data="adm_topdown")],
                ]),
            )
            return

        # RESELLER flow
        try:
            reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        except Exception as exc:
            logger.error("DB error in /start: %s", exc)
            await update.message.reply_text("Terjadi kesalahan. Coba lagi nanti.")
            return

        if not reseller:
            await update.message.reply_text(
                self.t("bot_text_not_registered") + "\n\nKetik `/daftar <nama> [phone]` untuk register.",
                parse_mode="Markdown",
            )
            return

        balance = reseller.get("balance", 0)
        name = reseller.get("name", "Reseller")
        await update.message.reply_text(
            self.t("bot_text_welcome", name=name, saldo=format_rp(balance)),
            reply_markup=self._main_menu_keyboard(),
        )

    # ── Callback router ──────────────────────────────────────

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        await query.answer()

        data = query.data or ""
        parts = data.split("|")
        action = parts[0]

        telegram_id = str(update.effective_user.id)

        try:
            if action == "menu":
                # Clear pending state saat balik ke menu
                context.user_data.pop("awaiting", None)
                await self._show_menu(query, telegram_id)
            elif action == "saldo":
                await self._show_saldo(query, telegram_id)
            elif action == "buy":
                if len(parts) == 1:
                    await self._show_profiles(query, telegram_id)
                elif len(parts) == 2:
                    await self._show_buy_qty(query, telegram_id, parts[1])
                elif len(parts) == 3 and parts[2] == "custom":
                    # User pilih input qty manual
                    context.user_data["awaiting"] = ("buy_qty", parts[1])
                    await query.edit_message_text(
                        "✏️ Ketik jumlah voucher yang ingin dibeli (1-100):",
                        reply_markup=self._back_button(),
                    )
                elif len(parts) == 3:
                    qty = int(parts[2])
                    await self._confirm_buy(query, telegram_id, parts[1], qty)
                elif len(parts) == 4 and parts[2] == "ok":
                    await self._execute_buy(query, telegram_id, parts[1], int(parts[3]))
            elif action == "deposit":
                if len(parts) == 1:
                    await self._show_deposit_amounts(query, telegram_id)
                elif len(parts) == 2 and parts[1] == "custom":
                    context.user_data["awaiting"] = ("deposit_amount", None)
                    await query.edit_message_text(
                        "✏️ Ketik nominal deposit (Rp), minimal 1000:",
                        reply_markup=self._back_button(),
                    )
                elif len(parts) == 2:
                    amount = int(parts[1])
                    # Prompt user upload foto bukti
                    context.user_data["awaiting"] = ("deposit_proof", amount)
                    await query.edit_message_text(
                        f"📸 Upload foto bukti transfer untuk deposit *{format_rp(amount)}*\n\n"
                        f"Atau ketik /skip kalau tidak ada bukti foto.",
                        parse_mode="Markdown",
                        reply_markup=self._back_button(),
                    )
            elif action == "approve":
                # Owner click approve|<deposit_id>
                await self._owner_approve(query, telegram_id, parts[1])
            elif action == "reject":
                # Owner click reject|<deposit_id>
                await self._owner_reject(query, telegram_id, parts[1])
            elif action == "wiz":
                # wiz|topup|sel|<reseller_id>  — admin pilih reseller
                if len(parts) >= 4 and parts[2] == "sel" and self._is_owner(telegram_id):
                    await self._wizard_select_reseller(query, context, parts[1], parts[3])
            elif action.startswith("adm_") and self._is_owner(telegram_id):
                # Admin shortcut buttons dari menu /start
                sub = action[4:]
                msg = query.message  # message that contains the button (use as reply target)
                if sub == "ai":
                    # Set state ai_chat manually + show usage
                    uid = self._get_user_internal_id(telegram_id)
                    usage = self._get_token_usage_summary(uid) if uid else {}
                    context.user_data["awaiting"] = ("ai_chat", {"started_at": datetime.now(timezone.utc).isoformat()})
                    self._schedule_ai_idle(context, msg.chat_id)
                    today_total = usage.get("today_in", 0) + usage.get("today_out", 0)
                    month_total = usage.get("month_in", 0) + usage.get("month_out", 0)
                    await msg.reply_text(
                        f"🤖 *AI Assistant aktif*\n\n"
                        f"📊 Token: hari ini {today_total} ({usage.get('today_calls',0)} call) · "
                        f"bulan {month_total} ({usage.get('month_calls',0)} call)\n\n"
                        "💬 Ketik pesan untuk chat dengan AI.\n⏱ Auto-stop 10mnt idle.",
                        parse_mode="Markdown",
                        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🛑 Stop AI", callback_data="stopai")]]),
                    )
                elif sub == "report":
                    # Inline report execution (mirip cmd_report tapi reply ke msg, bukan update.message)
                    await self._do_report(msg, telegram_id)
                elif sub in ("resource", "netwatch"):
                    routers = self._list_owner_routers(telegram_id)
                    if not routers:
                        await msg.reply_text("⚠️ Tidak ada router."); return
                    if len(routers) == 1:
                        if sub == "resource":
                            await self._do_resource(msg, telegram_id, routers[0])
                        else:
                            await self._do_netwatch(msg, telegram_id, routers[0])
                    else:
                        buttons = [[InlineKeyboardButton(r, callback_data=f"adminr|{sub}|{r}")] for r in routers]
                        buttons.append([InlineKeyboardButton("❌ Batal", callback_data="menu")])
                        await msg.reply_text(
                            f"📡 Pilih router untuk *{sub}*:",
                            parse_mode="Markdown",
                            reply_markup=InlineKeyboardMarkup(buttons),
                        )
                elif sub in ("topup", "topdown"):
                    # Wizard pilih reseller (msg used by _wizard_topup_topdown via update.message — bypass)
                    await self._wizard_admin_select_reseller(msg, telegram_id, sub)
            elif action == "stopai":
                # Klik tombol "Stop AI" — sama dengan /stopai
                if isinstance(context.user_data.get("awaiting"), tuple) and context.user_data["awaiting"][0] == "ai_chat":
                    context.user_data.pop("awaiting", None)
                    old_job = context.user_data.pop("ai_idle_job", None)
                    if old_job:
                        try: old_job.schedule_removal()
                        except Exception: pass
                    await query.edit_message_text("✅ Sesi AI dihentikan.", reply_markup=self._main_menu_keyboard())
                else:
                    await query.answer("Tidak dalam sesi AI.", show_alert=False)
            elif action == "adminr":
                # adminr|<action>|<router_name> — owner pilih router untuk admin command
                if len(parts) >= 3 and self._is_owner(telegram_id):
                    sub_action, router_name = parts[1], parts[2]
                    msg = query.message
                    # Hapus inline keyboard supaya tidak ke-klik 2x
                    try: await query.edit_message_text(f"📡 Router: *{router_name}*", parse_mode="Markdown")
                    except Exception: pass
                    if sub_action == "resource":
                        await self._do_resource(msg, telegram_id, router_name)
                    elif sub_action == "netwatch":
                        await self._do_netwatch(msg, telegram_id, router_name)
            elif action == "history":
                await self._show_history(query, telegram_id)
            else:
                await query.edit_message_text(
                    "Perintah tidak dikenal.",
                    reply_markup=self._back_button(),
                )
        except Exception as exc:
            logger.error("Callback error (%s): %s", data, exc, exc_info=True)
            try:
                await query.edit_message_text(
                    "Terjadi kesalahan. Coba lagi nanti.",
                    reply_markup=self._back_button(),
                )
            except Exception:
                pass

    # ── Menu ──────────────────────────────────────────────────

    async def _show_menu(self, query, telegram_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return
        balance = reseller.get("balance", 0)
        name = reseller.get("name", "Reseller")
        await query.edit_message_text(
            f"Halo {name}! Saldo: {format_rp(balance)}",
            reply_markup=self._main_menu_keyboard(),
        )

    # ── Saldo ─────────────────────────────────────────────────

    async def _show_saldo(self, query, telegram_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return
        balance = reseller.get("balance", 0)
        name = reseller.get("name", "Reseller")
        await query.edit_message_text(
            f"💰 Saldo {name}\n\n"
            f"Saldo saat ini: {format_rp(balance)}",
            reply_markup=self._back_button(),
        )

    # ── Pricing helper ────────────────────────────────────────

    @staticmethod
    def _calc_reseller_price(voucher_type: dict, reseller_discount_pct: int) -> int:
        """Compute price the reseller pays.

        Rule: harga jual ke reseller = harga - (harga × discount%).
        Mark-up only applies for the end-user-facing price; bot purchase uses harga.
        """
        harga = int(voucher_type.get("harga") or 0)
        disc = max(0, min(100, int(reseller_discount_pct or 0)))
        return max(0, harga - (harga * disc // 100))

    @staticmethod
    def _charset_for(type_char_raw: str) -> str:
        """Mirror health_server charset selection. No-ambiguous chars."""
        _NO_AMB_LOWER = "abcdefghjkmnpqrstuvwxyz"
        _NO_AMB_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"
        _NO_AMB_DIGIT = "23456789"
        tc = (type_char_raw or "Random abcd2345").lower()
        has_lower = any(c.islower() for c in (type_char_raw or "") if c.isalpha())
        has_upper = any(c.isupper() for c in (type_char_raw or "") if c.isalpha())
        has_digit = any(c.isdigit() for c in (type_char_raw or ""))
        if "1234" in tc and not any(x in tc for x in ["abcd", "ab", "aB", "AB"]):
            return string.digits
        parts = ""
        if has_lower:
            parts += _NO_AMB_LOWER
        if has_upper:
            parts += _NO_AMB_UPPER
        if has_digit:
            parts += _NO_AMB_DIGIT
        return parts or (_NO_AMB_LOWER + _NO_AMB_DIGIT)

    # ── Buy: voucher type list ───────────────────────────────

    async def _show_profiles(self, query, telegram_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        owner_user_id = reseller["userId"]  # internal User.id (FK target)
        reseller_groups = reseller.get("voucherGroup") or "default"
        reseller_disc = int(reseller.get("discount") or 0)

        types = self.vdb.list_voucher_types_for_reseller(owner_user_id, reseller_groups)
        if not types:
            await query.edit_message_text(
                "Belum ada jenis voucher yang tersedia untuk Anda.\nHubungi admin.",
                reply_markup=self._back_button(),
            )
            return

        buttons = []
        for vt in types:
            harga_jual = self._calc_reseller_price(vt, reseller_disc)
            label = f"{vt['namaVoucher']} — {format_rp(harga_jual)}"
            buttons.append([InlineKeyboardButton(label, callback_data=f"buy|{vt['id']}")])
        buttons.append([InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")])

        disc_note = f"\n_Diskon Anda: {reseller_disc}%_" if reseller_disc > 0 else ""
        await query.edit_message_text(
            f"🎫 Pilih jenis voucher:{disc_note}",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    # ── Buy: confirm ──────────────────────────────────────────

    async def _show_buy_qty(self, query, telegram_id: str, voucher_type_id: str) -> None:
        """Tampilkan pilihan quantity (1, 5, 10, 25, 50, custom)."""
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return
        vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
        if not vt or vt.get("userId") != reseller["userId"]:
            await query.edit_message_text("Jenis voucher tidak ditemukan.", reply_markup=self._back_button())
            return

        disc = int(reseller.get("discount") or 0)
        harga_jual = self._calc_reseller_price(vt, disc)
        balance = int(reseller.get("balance") or 0)
        max_qty = balance // harga_jual if harga_jual > 0 else 100
        max_qty = min(max_qty, 100)

        buttons = []
        row = []
        for q in [1, 5, 10, 25, 50]:
            if q <= max_qty:
                row.append(InlineKeyboardButton(f"× {q}", callback_data=f"buy|{voucher_type_id}|{q}"))
            if len(row) == 3:
                buttons.append(row); row = []
        if row: buttons.append(row)
        buttons.append([InlineKeyboardButton("✏️ Custom", callback_data=f"buy|{voucher_type_id}|custom")])
        buttons.append([InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")])

        await query.edit_message_text(
            f"🎫 *{vt['namaVoucher']}*\n"
            f"💵 Harga/voucher: {format_rp(harga_jual)}\n"
            f"💼 Saldo: {format_rp(balance)} (cukup max {max_qty} voucher)\n\n"
            f"Pilih jumlah:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    async def _confirm_buy(self, query, telegram_id: str, voucher_type_id: str, qty: int = 1) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
        if not vt or vt.get("userId") != reseller["userId"]:
            await query.edit_message_text("Jenis voucher tidak ditemukan.", reply_markup=self._back_button())
            return

        if qty < 1 or qty > 100:
            await query.edit_message_text("Jumlah tidak valid (1-100).", reply_markup=self._back_button())
            return

        balance = int(reseller.get("balance") or 0)
        disc = int(reseller.get("discount") or 0)
        harga = int(vt.get("harga") or 0)
        harga_jual = self._calc_reseller_price(vt, disc)
        total_bayar = harga_jual * qty
        saldo_setelah = balance - total_bayar

        disc_line = f"\n💸 Diskon ({disc}%): -{format_rp((harga - harga_jual) * qty)}" if disc > 0 else ""
        warn = "" if saldo_setelah >= 0 else "\n\n⚠️ Saldo tidak mencukupi!"

        await query.edit_message_text(
            f"Beli *{qty}* voucher *{vt['namaVoucher']}*?\n\n"
            f"📶 Profile: `{vt['profile']}`\n"
            f"💰 Harga satuan: {format_rp(harga)}\n"
            f"📦 Quantity: × {qty}{disc_line}\n"
            f"💵 Total bayar: *{format_rp(total_bayar)}*\n"
            f"💼 Saldo: {format_rp(balance)} → {format_rp(saldo_setelah)}{warn}",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton(f"✅ Ya, beli {qty}", callback_data=f"buy|{voucher_type_id}|ok|{qty}"),
                    InlineKeyboardButton("❌ Batal", callback_data="menu"),
                ],
            ]),
        )

    # ── Buy: execute ──────────────────────────────────────────

    async def _execute_buy(self, query, telegram_id: str, voucher_type_id: str, qty: int = 1) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
        if not vt or vt.get("userId") != reseller["userId"]:
            await query.edit_message_text("Jenis voucher tidak ditemukan.", reply_markup=self._back_button())
            return

        if qty < 1 or qty > 100:
            await query.edit_message_text("Jumlah tidak valid.", reply_markup=self._back_button())
            return

        owner_tid = reseller.get("ownerTelegramId", self.owner_telegram_id)
        reseller_id = reseller["id"]
        disc = int(reseller.get("discount") or 0)
        price_per_unit = self._calc_reseller_price(vt, disc)
        total_price = price_per_unit * qty
        balance = int(reseller.get("balance") or 0)

        if total_price > 0 and balance < total_price:
            await query.edit_message_text(
                f"⚠️ Saldo tidak cukup.\nSaldo: {format_rp(balance)}\nButuh: {format_rp(total_price)} ({qty} voucher)",
                reply_markup=self._back_button(),
            )
            return

        try:
            reg = _get_registry()
            # Resolve router via Reseller.routerId (kunci 1 reseller = 1 router).
            # Fallback ke default kalau routerName kosong (legacy data).
            target_router = reseller.get("routerName") or None
            conn = reg.resolve(owner_tid, target_router)
        except Exception as exc:
            logger.error("Router resolve failed: %s", exc)
            await query.edit_message_text("Tidak dapat terhubung ke router. Hubungi admin.", reply_markup=self._back_button())
            return

        prefix = vt.get("prefix") or ""
        char_len = max(3, int(vt.get("panjangKarakter") or 6))
        type_login = vt.get("typeLogin") or "Username = Password"
        charset = self._charset_for(vt.get("typeChar") or "Random abcd2345")
        profile_name = vt["profile"]
        server = vt.get("server") or ""
        limit_uptime = vt.get("limitUptime") or ""
        limit_total_bytes = int(vt.get("limitQuotaTotal") or 0)

        # Notify "processing" untuk qty besar
        if qty >= 5:
            await query.edit_message_text(f"⏳ Generating {qty} voucher, mohon tunggu...")

        created_vouchers = []
        try:
            with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                existing = {u.get("name", "") for u in api.path("ip", "hotspot", "user")}
                for i in range(qty):
                    # Generate unique username
                    for _ in range(10):
                        username = prefix + "".join(random.choices(charset, k=char_len))
                        if username not in existing: break
                    else:
                        # Skip kalau gagal unik setelah 10 retry
                        continue
                    existing.add(username)
                    password = username if type_login == "Username = Password" else "".join(random.choices(charset, k=char_len))

                    add_params = {"name": username, "password": password, "profile": profile_name}
                    if server and server != "all":
                        add_params["server"] = server
                    if limit_uptime and limit_uptime != "0":
                        add_params["limit-uptime"] = limit_uptime
                    if limit_total_bytes > 0:
                        add_params["limit-bytes-total"] = str(limit_total_bytes)
                    api.path("ip", "hotspot", "user").add(**add_params)
                    created_vouchers.append({"username": username, "password": password})
        except Exception as exc:
            logger.error("Voucher creation on router failed: %s", exc)
            if not created_vouchers:
                await query.edit_message_text("Gagal membuat voucher di router. Coba lagi nanti.", reply_markup=self._back_button())
                return
            # Sebagian sukses — lanjut deduct sesuai jumlah yg sukses

        actual_qty = len(created_vouchers)
        actual_total = price_per_unit * actual_qty
        balance_after = balance
        if actual_total > 0:
            try:
                tx = self.vdb.deduct_saldo(
                    reseller_id, actual_total,
                    description=f"{actual_qty}× Voucher {vt['namaVoucher']}",
                )
                balance_after = tx["balanceAfter"]
            except ValueError as exc:
                logger.warning("Saldo deduction failed: %s", exc)
                await query.edit_message_text(
                    f"⚠️ {actual_qty} voucher dibuat tapi saldo gagal dipotong. Hubungi admin.\n{exc}",
                    reply_markup=self._back_button(),
                )
                return

        try:
            self.vdb.save_batch(
                user_id=owner_tid,
                router_name=conn.get("name", ""),
                profile=profile_name,
                vouchers=created_vouchers,
                source="reseller_bot",
                reseller_id=reseller_id,
                price_per_unit=price_per_unit,
            )
        except Exception as exc:
            logger.warning("Failed to persist batch: %s", exc)

        # Format response — kalau >5 voucher, kirim sebagai code-block compact
        if actual_qty <= 5:
            voucher_lines = "\n".join(
                f"• `{v['username']}` / `{v['password']}`" for v in created_vouchers
            )
        else:
            voucher_lines = "```\n" + "\n".join(
                f"{v['username']:<10} {v['password']}" for v in created_vouchers
            ) + "\n```"

        await query.edit_message_text(
            f"✅ {actual_qty} voucher berhasil dibuat!\n\n"
            f"🎫 *{vt['namaVoucher']}* ({profile_name})\n\n"
            f"{voucher_lines}\n\n"
            f"💵 Total: {format_rp(actual_total)} | 💰 Sisa: {format_rp(balance_after)}",
            parse_mode="Markdown",
            reply_markup=self._back_button(),
        )

    # ── Deposit: amount selection ─────────────────────────────

    async def _show_deposit_amounts(self, query, telegram_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        amounts = [10_000, 25_000, 50_000, 100_000]
        buttons = [
            [
                InlineKeyboardButton(format_rp(amounts[0]), callback_data=f"deposit|{amounts[0]}"),
                InlineKeyboardButton(format_rp(amounts[1]), callback_data=f"deposit|{amounts[1]}"),
            ],
            [
                InlineKeyboardButton(format_rp(amounts[2]), callback_data=f"deposit|{amounts[2]}"),
                InlineKeyboardButton(format_rp(amounts[3]), callback_data=f"deposit|{amounts[3]}"),
            ],
            [InlineKeyboardButton("✏️ Nominal Lain", callback_data="deposit|custom")],
            [InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")],
        ]
        await query.edit_message_text(
            "💳 Pilih jumlah deposit:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    # ── Deposit: send request (after photo or skip) ──────────────

    async def _send_deposit_request(self, bot, telegram_id: str, amount: int, photo_file_id: str | None) -> bool:
        """Notify owner dengan inline approve/reject button. Return True kalau sukses."""
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            return False

        reseller_name = reseller.get("name", "Reseller")
        reseller_phone = reseller.get("phone", "-")
        owner_tid = reseller.get("ownerTelegramId", self.owner_telegram_id)

        # Generate deposit request ID + simpan ke in-memory pending dict
        import uuid
        dep_id = uuid.uuid4().hex[:12]
        self._pending_deposits[dep_id] = {
            "reseller_id": reseller["id"],
            "telegram_id": telegram_id,
            "amount": amount,
            "photo_file_id": photo_file_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        caption = (
            f"📥 *Request Deposit*\n\n"
            f"Reseller: {reseller_name}\n"
            f"Telepon: {reseller_phone}\n"
            f"Jumlah: *{format_rp(amount)}*\n"
            f"Waktu: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        )
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Setujui", callback_data=f"approve|{dep_id}"),
            InlineKeyboardButton("❌ Tolak", callback_data=f"reject|{dep_id}"),
        ]])

        try:
            if photo_file_id:
                await bot.send_photo(
                    chat_id=int(owner_tid),
                    photo=photo_file_id,
                    caption=caption,
                    parse_mode="Markdown",
                    reply_markup=keyboard,
                )
            else:
                await bot.send_message(
                    chat_id=int(owner_tid),
                    text=caption + "\n\n_(tidak ada foto bukti)_",
                    parse_mode="Markdown",
                    reply_markup=keyboard,
                )
            return True
        except Exception as exc:
            logger.error("Failed to send deposit notification to owner %s: %s", owner_tid, exc)
            self._pending_deposits.pop(dep_id, None)
            return False

    # ── Owner approve / reject deposit ─────────────────────────

    async def _owner_approve(self, query, owner_telegram_id: str, dep_id: str) -> None:
        """Owner approve pending deposit — top up reseller saldo + notif ke reseller."""
        dep = self._pending_deposits.get(dep_id)
        if not dep:
            await query.edit_message_caption(
                caption="⚠️ Request deposit ini sudah diproses sebelumnya atau expired.",
            ) if query.message.photo else await query.edit_message_text("⚠️ Sudah diproses.")
            return

        # Verify owner is allowed (must match reseller's owner)
        reseller = self.vdb.get_reseller_by_id(dep["reseller_id"]) if hasattr(self.vdb, "get_reseller_by_id") else None
        # Top up via existing service
        try:
            tx = self.vdb.add_saldo(
                dep["reseller_id"],
                dep["amount"],
                description=f"Top up via bot (approved by admin)",
            )
            balance_after = tx.get("balanceAfter", 0)
        except Exception as exc:
            logger.error("Top up failed for deposit %s: %s", dep_id, exc)
            await query.answer("Gagal top up: " + str(exc), show_alert=True)
            return

        # Notif reseller
        try:
            await query.get_bot().send_message(
                chat_id=int(dep["telegram_id"]),
                text=(
                    f"✅ Deposit *{format_rp(dep['amount'])}* DISETUJUI!\n\n"
                    f"💰 Saldo baru: *{format_rp(balance_after)}*"
                ),
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.warning("Failed to notify reseller %s: %s", dep["telegram_id"], exc)

        # Update owner's message
        new_caption = f"✅ DISETUJUI — {format_rp(dep['amount'])} ditambahkan ke saldo reseller"
        try:
            if query.message.photo:
                await query.edit_message_caption(caption=new_caption)
            else:
                await query.edit_message_text(new_caption)
        except Exception:
            pass
        self._pending_deposits.pop(dep_id, None)

    async def _owner_reject(self, query, owner_telegram_id: str, dep_id: str) -> None:
        dep = self._pending_deposits.get(dep_id)
        if not dep:
            await query.answer("Sudah diproses.", show_alert=True)
            return
        try:
            await query.get_bot().send_message(
                chat_id=int(dep["telegram_id"]),
                text=f"❌ Deposit *{format_rp(dep['amount'])}* DITOLAK admin. Silakan hubungi admin untuk klarifikasi.",
                parse_mode="Markdown",
            )
        except Exception:
            pass
        new_caption = f"❌ DITOLAK — {format_rp(dep['amount'])}"
        try:
            if query.message.photo:
                await query.edit_message_caption(caption=new_caption)
            else:
                await query.edit_message_text(new_caption)
        except Exception:
            pass
        self._pending_deposits.pop(dep_id, None)

    # ── Text & Photo input handler (state-based) ─────────────────

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle text/photo messages based on awaiting state set by callback."""
        awaiting = context.user_data.get("awaiting")
        if not awaiting:
            return  # bukan dalam state input — ignore
        kind, payload = awaiting if isinstance(awaiting, tuple) else (awaiting, None)
        msg = update.message

        if msg.text == "/skip" and kind == "deposit_proof":
            # User skip foto bukti — kirim deposit request tanpa foto
            context.user_data.pop("awaiting", None)
            ok = await self._send_deposit_request(msg.get_bot(), str(update.effective_user.id), payload, None)
            await msg.reply_text(
                f"✅ Request deposit {format_rp(payload)} dikirim ke admin (tanpa foto).\n"
                f"Tunggu konfirmasi dari admin." if ok else "⚠️ Gagal kirim ke admin.",
                reply_markup=self._main_menu_keyboard(),
            )
            return

        if msg.photo and kind == "deposit_proof":
            # Ambil resolusi tertinggi
            file_id = msg.photo[-1].file_id
            context.user_data.pop("awaiting", None)
            ok = await self._send_deposit_request(msg.get_bot(), str(update.effective_user.id), payload, file_id)
            await msg.reply_text(
                f"✅ Request deposit *{format_rp(payload)}* + bukti foto dikirim ke admin.\n"
                f"Tunggu konfirmasi." if ok else "⚠️ Gagal kirim ke admin.",
                parse_mode="Markdown",
                reply_markup=self._main_menu_keyboard(),
            )
            return

        if msg.text and kind == "deposit_amount":
            try:
                amount = int(msg.text.replace(".", "").replace(",", "").replace("Rp", "").strip())
                if amount < 1000:
                    raise ValueError("min 1000")
            except (ValueError, TypeError):
                await msg.reply_text("⚠️ Nominal tidak valid. Ketik angka, minimal 1000:")
                return
            # Set state berikutnya: tunggu foto
            context.user_data["awaiting"] = ("deposit_proof", amount)
            await msg.reply_text(
                f"📸 Upload foto bukti transfer untuk deposit *{format_rp(amount)}*\n\n"
                f"Atau ketik /skip kalau tidak ada foto.",
                parse_mode="Markdown",
            )
            return

        if msg.text and kind == "ai_chat":
            # Forward ke nanobot, jangan clear state (multi-turn)
            await self._ai_chat_forward(msg, context, str(update.effective_user.id), msg.text)
            return

        if msg.text and kind == "wiz_amount":
            # Admin wizard topup/topdown — input amount
            try:
                amount = int(msg.text.replace(".", "").replace(",", "").replace("Rp", "").strip())
                if amount < 1:
                    raise ValueError()
            except (ValueError, TypeError):
                await msg.reply_text("⚠️ Nominal tidak valid. Ketik angka:")
                return
            context.user_data.pop("awaiting", None)
            await self._wizard_execute(msg, context, payload, amount)
            return

        if msg.text and kind == "buy_qty":
            try:
                qty = int(msg.text.strip())
                if not (1 <= qty <= 100):
                    raise ValueError()
            except (ValueError, TypeError):
                await msg.reply_text("⚠️ Jumlah tidak valid (1-100). Ketik angka:")
                return
            context.user_data.pop("awaiting", None)
            voucher_type_id = payload
            # Simulate inline button click — kirim sebagai message dengan inline keyboard
            reseller = self.vdb.get_reseller_by_telegram(str(update.effective_user.id))
            if not reseller:
                await msg.reply_text("Anda belum terdaftar.")
                return
            vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
            if not vt:
                await msg.reply_text("Voucher type tidak ditemukan.")
                return
            disc = int(reseller.get("discount") or 0)
            harga_jual = self._calc_reseller_price(vt, disc)
            total_bayar = harga_jual * qty
            balance = int(reseller.get("balance") or 0)

            await msg.reply_text(
                f"Beli *{qty}* voucher *{vt['namaVoucher']}*?\n\n"
                f"💵 Total: *{format_rp(total_bayar)}*\n"
                f"💼 Saldo: {format_rp(balance)} → {format_rp(balance - total_bayar)}",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(f"✅ Ya, beli {qty}", callback_data=f"buy|{voucher_type_id}|ok|{qty}"),
                    InlineKeyboardButton("❌ Batal", callback_data="menu"),
                ]]),
            )
            return

    # ── History ───────────────────────────────────────────────

    async def _show_history(self, query, telegram_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        transactions = self.vdb.get_transactions(reseller["id"], limit=10)
        if not transactions:
            await query.edit_message_text(
                "📋 Belum ada riwayat transaksi.",
                reply_markup=self._back_button(),
            )
            return

        type_labels = {
            "TOP_UP": "➕ Top Up",
            "TOP_DOWN": "➖ Top Down",
            "VOUCHER_PURCHASE": "🎫 Beli Voucher",
        }

        lines = ["📋 *Riwayat Transaksi (10 terakhir)*\n"]
        for tx in transactions:
            tx_type = type_labels.get(tx.get("type", ""), tx.get("type", ""))
            amount = tx.get("amount", 0)
            after = tx.get("balanceAfter", 0)
            desc = tx.get("description", "")
            created = tx.get("createdAt", "")
            if isinstance(created, str) and len(created) >= 10:
                created = created[:10]

            line = f"{tx_type} {format_rp(amount)}"
            if desc:
                line += f" - {desc}"
            line += f"\n   Saldo: {format_rp(after)} | {created}"
            lines.append(line)

        await query.edit_message_text(
            "\n".join(lines),
            parse_mode="Markdown",
            reply_markup=self._back_button(),
        )

    # ── Owner check ───────────────────────────────────────────

    def _is_owner(self, telegram_id: str) -> bool:
        """Cek apakah telegram_id ini owner dari bot ini."""
        return str(telegram_id) == str(self.owner_telegram_id)

    # ── Reseller commands ────────────────────────────────────

    async def cmd_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Alias untuk /start — show menu utama."""
        await self.start_command(update, context)

    async def cmd_ceksaldo(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        telegram_id = str(update.effective_user.id)
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await update.message.reply_text("Anda belum terdaftar. Ketik /daftar untuk register.")
            return
        await update.message.reply_text(
            f"💰 Saldo {reseller.get('name','-')}: *{format_rp(reseller.get('balance', 0))}*",
            parse_mode="Markdown",
        )

    async def cmd_deposit(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Trigger inline deposit menu."""
        telegram_id = str(update.effective_user.id)
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await update.message.reply_text("Anda belum terdaftar. Ketik /daftar untuk register.")
            return
        await update.message.reply_text(
            "💳 Pilih jumlah deposit:",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Rp 10.000", callback_data="deposit|10000"),
                 InlineKeyboardButton("Rp 25.000", callback_data="deposit|25000")],
                [InlineKeyboardButton("Rp 50.000", callback_data="deposit|50000"),
                 InlineKeyboardButton("Rp 100.000", callback_data="deposit|100000")],
                [InlineKeyboardButton("✏️ Nominal Lain", callback_data="deposit|custom")],
                [InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")],
            ]),
        )

    async def cmd_daftar(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Self-registration: kirim request daftar ke owner.
        Format: /daftar <nama> [phone]"""
        telegram_id = str(update.effective_user.id)
        # Cek sudah terdaftar?
        existing = self.vdb.get_reseller_by_telegram(telegram_id)
        if existing:
            await update.message.reply_text(
                f"✅ Anda sudah terdaftar sebagai *{existing['name']}*.\nGunakan /menu untuk akses fitur.",
                parse_mode="Markdown",
            )
            return

        args = context.args or []
        if not args:
            await update.message.reply_text(
                "📝 *Daftar reseller baru*\n\n"
                "Format: `/daftar <nama> [nomor_hp]`\n"
                "Contoh: `/daftar Pudding 081234567890`",
                parse_mode="Markdown",
            )
            return

        name = args[0]
        phone = args[1] if len(args) > 1 else ""
        # Notif owner — owner manual approve via dashboard (tambah reseller dengan telegramId ini)
        try:
            await update.message.get_bot().send_message(
                chat_id=int(self.owner_telegram_id),
                text=(
                    f"📝 *Pendaftaran Reseller Baru*\n\n"
                    f"Telegram ID: `{telegram_id}`\n"
                    f"Nama: {name}\n"
                    f"Telepon: {phone or '-'}\n"
                    f"Username: @{update.effective_user.username or '-'}\n\n"
                    f"Approve via dashboard /resellers atau abaikan untuk tolak."
                ),
                parse_mode="Markdown",
            )
            await update.message.reply_text(
                f"✅ Pendaftaran *{name}* dikirim ke admin.\n"
                f"Tunggu admin approve, lalu /menu untuk akses fitur.",
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.error("Daftar notif failed: %s", exc)
            await update.message.reply_text("⚠️ Gagal kirim ke admin. Hubungi admin manual.")

    async def cmd_cek(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Cek status hotspot user. Format: /cek <username>"""
        args = context.args or []
        if not args:
            await update.message.reply_text("Format: /cek <username>\nContoh: /cek vc1234")
            return
        target = args[0]
        telegram_id = str(update.effective_user.id)
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller and not self._is_owner(telegram_id):
            await update.message.reply_text("Anda belum terdaftar.")
            return

        owner_tid = reseller.get("ownerTelegramId", self.owner_telegram_id) if reseller else self.owner_telegram_id
        # Reseller dikunci ke 1 router (Reseller.routerId). Owner pakai router default.
        target_router = (reseller.get("routerName") if reseller else None) or None
        try:
            reg = _get_registry()
            conn = reg.resolve(owner_tid, target_router)
            with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                users = list(api.path("ip", "hotspot", "user"))
                user = next((u for u in users if u.get("name") == target), None)
                if not user:
                    await update.message.reply_text(f"❌ User `{target}` tidak ditemukan.", parse_mode="Markdown")
                    return
                # Cek apakah aktif sekarang
                actives = list(api.path("ip", "hotspot", "active"))
                active = next((a for a in actives if a.get("user") == target), None)

            disabled = str(user.get("disabled", "false")).lower() == "true"
            status = "🟢 ONLINE" if active else ("⚪ OFFLINE" if not disabled else "🔴 DISABLED")
            lines = [
                f"🎫 *{target}*",
                f"Status: {status}",
                f"Profile: `{user.get('profile', '-')}`",
                f"Comment: {user.get('comment', '-') or '-'}",
            ]
            if active:
                lines.extend([
                    f"IP: `{active.get('address', '-')}`",
                    f"MAC: `{active.get('mac-address', '-')}`",
                    f"Uptime: {active.get('uptime', '-')}",
                    f"↓ {int(active.get('bytes-in', 0))/1024/1024:.1f} MB · ↑ {int(active.get('bytes-out', 0))/1024/1024:.1f} MB",
                ])
            await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
        except Exception as exc:
            logger.error("/cek error: %s", exc)
            await update.message.reply_text(f"⚠️ Error: {exc}")

    async def cmd_qrcode(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Generate QR code untuk login voucher. Format: /qrcode <username> [password]"""
        args = context.args or []
        if not args:
            await update.message.reply_text(
                "Format: /qrcode <username> [password]\n"
                "Contoh: /qrcode vc1234 abc123\n"
                "Kalau password tidak diberikan, dipakai username (default 'username = password').",
            )
            return
        username = args[0]
        password = args[1] if len(args) > 1 else username

        try:
            import qrcode
            from io import BytesIO
            # QR berisi text "username:password" — bisa di-scan dengan app yg pintar
            qr_data = f"User: {username}\nPassword: {password}"
            img = qrcode.make(qr_data)
            buf = BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            await update.message.reply_photo(
                photo=buf,
                caption=f"🎫 *Voucher QR*\n\n👤 `{username}`\n🔑 `{password}`",
                parse_mode="Markdown",
            )
        except ImportError:
            await update.message.reply_text("⚠️ Library qrcode belum ter-install di agent.")
        except Exception as exc:
            logger.error("/qrcode error: %s", exc)
            await update.message.reply_text(f"⚠️ Error: {exc}")

    # ── /ai command — chat dengan AI Assistant (nanobot) ────

    AI_IDLE_SECONDS = 600  # 10 menit auto-stop kalau idle

    def _get_user_internal_id(self, telegram_id: str) -> str | None:
        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT id FROM "User" WHERE "telegramId" = %s', (telegram_id,))
            row = cur.fetchone()
            return row[0] if row else None

    def _get_token_usage_summary(self, user_internal_id: str) -> dict:
        """Return today + month token totals (WITA tz)."""
        from datetime import datetime as _dt, timezone as _tz, timedelta as _td
        wita = _tz(_td(hours=8))
        now = _dt.now(wita)
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(_tz.utc)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(_tz.utc)
        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute(
                'SELECT COALESCE(SUM("tokensIn"),0), COALESCE(SUM("tokensOut"),0), COUNT(*) '
                'FROM "TokenUsage" WHERE "userId"=%s AND timestamp >= %s',
                (user_internal_id, start_today),
            )
            t_in, t_out, t_calls = cur.fetchone()
            cur.execute(
                'SELECT COALESCE(SUM("tokensIn"),0), COALESCE(SUM("tokensOut"),0), COUNT(*) '
                'FROM "TokenUsage" WHERE "userId"=%s AND timestamp >= %s',
                (user_internal_id, start_month),
            )
            m_in, m_out, m_calls = cur.fetchone()
        return {
            "today_in": int(t_in), "today_out": int(t_out), "today_calls": t_calls,
            "month_in": int(m_in), "month_out": int(m_out), "month_calls": m_calls,
        }

    def _track_token_usage(self, user_internal_id: str, tokens_in: int, tokens_out: int, model: str, session_id: str) -> None:
        try:
            with self.vdb._conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    'INSERT INTO "TokenUsage" (id, "userId", "tokensIn", "tokensOut", model, "sessionId", timestamp) '
                    'VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, NOW())',
                    (user_internal_id, tokens_in, tokens_out, model, session_id),
                )
        except Exception as exc:
            logger.warning("Token usage insert failed: %s", exc)

    async def _ai_idle_callback(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """JobQueue callback: notify user sesi AI berakhir karena idle 10 menit."""
        job = context.job
        chat_id = job.chat_id
        try:
            await context.bot.send_message(
                chat_id=chat_id,
                text="💤 Sesi AI berakhir (idle 10 menit).\nKetik /ai untuk mulai chat lagi.",
                reply_markup=self._main_menu_keyboard(),
            )
            user_data = context.application.user_data.get(chat_id, {})
            if isinstance(user_data.get("awaiting"), tuple) and user_data["awaiting"][0] == "ai_chat":
                user_data.pop("awaiting", None)
                user_data.pop("ai_idle_job", None)
        except Exception as exc:
            logger.warning("AI idle callback failed: %s", exc)

    def _schedule_ai_idle(self, context: ContextTypes.DEFAULT_TYPE, chat_id: int) -> None:
        """Cancel old idle job + schedule baru."""
        if not getattr(context.application, "job_queue", None):
            return
        old_job = context.user_data.get("ai_idle_job")
        if old_job:
            try: old_job.schedule_removal()
            except Exception: pass
        job = context.application.job_queue.run_once(
            self._ai_idle_callback, when=self.AI_IDLE_SECONDS,
            chat_id=chat_id, name=f"ai_idle_{chat_id}",
        )
        context.user_data["ai_idle_job"] = job

    async def cmd_ai(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Mulai sesi AI Assistant (nanobot). Show usage + auto-stop 10 menit idle.

        Akses: owner only (LLM API berbiaya).
        """
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text(
                "⛔ AI Assistant hanya untuk owner. Hubungi admin kalau perlu akses.",
            )
            return

        uid = self._get_user_internal_id(telegram_id)
        usage = self._get_token_usage_summary(uid) if uid else {}

        context.user_data["awaiting"] = ("ai_chat", {"started_at": datetime.now(timezone.utc).isoformat()})
        chat_id = update.effective_chat.id
        self._schedule_ai_idle(context, chat_id)

        today_total = usage.get("today_in", 0) + usage.get("today_out", 0)
        month_total = usage.get("month_in", 0) + usage.get("month_out", 0)
        await update.message.reply_text(
            "🤖 *AI Assistant aktif*\n\n"
            f"📊 *Token Usage*\n"
            f"  Hari ini: {today_total:,} token ({usage.get('today_calls', 0)} call)\n"
            f"  Bulan ini: {month_total:,} token ({usage.get('month_calls', 0)} call)\n\n"
            "💬 Ketik pesan apa saja untuk chat dengan AI.\n"
            "⏱ Auto-stop setelah 10 menit idle.\n"
            "🛑 Ketik /stopai untuk akhiri sesi sekarang.".replace(",", "."),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🛑 Stop AI", callback_data="stopai")],
            ]),
        )

    async def cmd_stopai(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Manual stop AI session."""
        if isinstance(context.user_data.get("awaiting"), tuple) and context.user_data["awaiting"][0] == "ai_chat":
            context.user_data.pop("awaiting", None)
            old_job = context.user_data.pop("ai_idle_job", None)
            if old_job:
                try: old_job.schedule_removal()
                except Exception: pass
            await update.message.reply_text("✅ Sesi AI dihentikan.", reply_markup=self._main_menu_keyboard())
        else:
            await update.message.reply_text("Tidak sedang dalam sesi AI.")

    async def _ai_chat_forward(self, msg, context: ContextTypes.DEFAULT_TYPE, telegram_id: str, text: str) -> None:
        """Forward user text ke nanobot, kembalikan response, track tokens, reschedule idle."""
        import urllib.request, urllib.error, asyncio, os
        chat_id = msg.chat_id
        try: await context.bot.send_chat_action(chat_id=chat_id, action="typing")
        except Exception: pass

        # Pakai health_server proxy port 8080 (BUKAN nanobot 18790 langsung).
        # Health server inject [ctx: user_id=...] supaya agent tahu user mana untuk
        # akses MCP tool & router yang benar.
        nanobot_url = os.environ.get("CHAT_PROXY_URL", "http://localhost:8080")
        session_id = f"telegram-{telegram_id}"

        body = json.dumps({
            "messages": [{"role": "user", "content": text}],
            "session_id": session_id,
            "user_context": {"telegram_id": telegram_id},
        }).encode()
        req = urllib.request.Request(
            f"{nanobot_url}/v1/chat/completions",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            loop = asyncio.get_event_loop()
            def _do_request():
                with urllib.request.urlopen(req, timeout=60) as resp:
                    return resp.read().decode("utf-8")
            raw = await loop.run_in_executor(None, _do_request)
            data = json.loads(raw)
        except urllib.error.HTTPError as e:
            await msg.reply_text(f"⚠️ AI error: HTTP {e.code}")
            return
        except Exception as e:
            await msg.reply_text(f"⚠️ AI error: {e}")
            return

        reply = (
            (data.get("choices") or [{}])[0].get("message", {}).get("content")
            or data.get("response")
            or "(tidak ada respons)"
        )
        usage = data.get("usage") or {}
        if usage:
            uid = self._get_user_internal_id(telegram_id)
            if uid:
                self._track_token_usage(
                    uid,
                    int(usage.get("prompt_tokens") or 0),
                    int(usage.get("completion_tokens") or 0),
                    data.get("model", ""),
                    session_id,
                )
        # Truncate Telegram message limit 4096
        await msg.reply_text(reply[:4000])
        # Reschedule idle timer
        self._schedule_ai_idle(context, chat_id)

    # ── Admin commands ───────────────────────────────────────

    def _list_owner_routers(self, telegram_id: str) -> list[str]:
        """Return list of router names owned by this user (default first)."""
        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT id FROM "User" WHERE "telegramId" = %s', (telegram_id,))
            row = cur.fetchone()
            if not row: return []
            cur.execute(
                'SELECT name FROM "Router" WHERE "userId" = %s ORDER BY "isDefault" DESC, "addedAt" ASC',
                (row[0],),
            )
            return [r[0] for r in cur.fetchall()]

    async def _resolve_owner_router(self, update, context, action_label: str) -> str | None:
        """Resolve router buat owner command:
        - args[0] dikasih → pakai itu langsung
        - kalau tidak ada arg + 1 router → auto pakai
        - kalau tidak ada arg + >1 router → tampil inline picker (callback adminr|<action>|<router>)
          dan return None (caller bail; click button → callback handler trigger _do_xxx ulang)
        """
        telegram_id = str(update.effective_user.id)
        args = context.args or []
        if args:
            return args[0]
        routers = self._list_owner_routers(telegram_id)
        if not routers:
            await update.message.reply_text("⚠️ Tidak ada router terdaftar. Tambah dulu via dashboard.")
            return None
        if len(routers) == 1:
            return routers[0]
        buttons = [[InlineKeyboardButton(r, callback_data=f"adminr|{action_label}|{r}")] for r in routers]
        buttons.append([InlineKeyboardButton("❌ Batal", callback_data="menu")])
        await update.message.reply_text(
            f"📡 Pilih router untuk `/{action_label}`:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return None

    async def cmd_resource(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin: cek resource router. /resource [router_name]"""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only."); return
        target = await self._resolve_owner_router(update, context, "resource")
        if not target: return
        await self._do_resource(update.message, telegram_id, target)

    async def _do_resource(self, msg, telegram_id: str, router_name: str) -> None:
        try:
            reg = _get_registry()
            conn = reg.resolve(telegram_id, router_name)
            with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                res = list(api.path("system", "resource"))
                if not res:
                    await msg.reply_text("⚠️ Tidak ada data resource."); return
                r = res[0]
                free_mem = int(r.get("free-memory", 0))
                total_mem = int(r.get("total-memory", 1))
                free_hdd = int(r.get("free-hdd-space", 0))
                total_hdd = int(r.get("total-hdd-space", 1))
                mem_pct = round((1 - free_mem/total_mem) * 100, 1)
                hdd_pct = round((1 - free_hdd/total_hdd) * 100, 1)
                await msg.reply_text(
                    f"🖥 *Resource {conn.get('name','-')}*\n\n"
                    f"Board: `{r.get('board-name','-')}`\n"
                    f"Version: `{r.get('version','-')}`\n"
                    f"Uptime: {r.get('uptime','-')}\n"
                    f"CPU: *{r.get('cpu-load',0)}%*\n"
                    f"RAM: *{mem_pct}%* ({free_mem//1024//1024} MB free / {total_mem//1024//1024} MB)\n"
                    f"HDD: *{hdd_pct}%* ({free_hdd//1024//1024} MB free)",
                    parse_mode="Markdown",
                )
        except Exception as exc:
            logger.error("/resource error: %s", exc)
            await msg.reply_text(f"⚠️ Error: {exc}")

    async def cmd_netwatch(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin: list netwatch entries. /netwatch [router_name]"""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only."); return
        target = await self._resolve_owner_router(update, context, "netwatch")
        if not target: return
        await self._do_netwatch(update.message, telegram_id, target)

    async def _do_netwatch(self, msg, telegram_id: str, router_name: str) -> None:
        try:
            reg = _get_registry()
            conn = reg.resolve(telegram_id, router_name)
            with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                items = list(api.path("tool", "netwatch"))
                if not items:
                    await msg.reply_text("⚠️ Belum ada netwatch entry."); return
                up = sum(1 for i in items if i.get("status") == "up")
                down = sum(1 for i in items if i.get("status") == "down")
                lines = [f"📡 *Netwatch {conn.get('name','-')}*\n",
                         f"🟢 UP: {up} | 🔴 DOWN: {down} | Total: {len(items)}\n"]
                items_sorted = sorted(items, key=lambda x: 0 if x.get("status") == "down" else 1)
                for i in items_sorted[:25]:
                    icon = "🔴" if i.get("status") == "down" else "🟢"
                    lines.append(f"{icon} `{i.get('host','-')}` {i.get('comment','') or ''}")
                if len(items) > 25:
                    lines.append(f"\n_+{len(items)-25} more_")
                await msg.reply_text("\n".join(lines), parse_mode="Markdown")
        except Exception as exc:
            logger.error("/netwatch error: %s", exc)
            await msg.reply_text(f"⚠️ Error: {exc}")

    async def cmd_report(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin: penjualan hari ini + bulan ini."""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only.")
            return
        await self._do_report(update.message, telegram_id)

    async def _do_report(self, msg, telegram_id: str) -> None:
        """Reusable report sender — bisa dipanggil dari /report atau callback button."""
        try:
            from datetime import datetime as _dt
            from datetime import timezone as _tz, timedelta as _td
            wita = _tz(_td(hours=8))
            now = _dt.now(wita)
            start_today = now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(_tz.utc)
            start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).astimezone(_tz.utc)

            with self.vdb._conn() as conn:
                cur = conn.cursor()
                cur.execute('SELECT id FROM "User" WHERE "telegramId" = %s', (telegram_id,))
                row = cur.fetchone()
                if not row:
                    await msg.reply_text("⚠️ User tidak ditemukan."); return
                uid = row[0]
                cur.execute(
                    """SELECT COUNT(*), COALESCE(SUM(count),0), COALESCE(SUM("totalCost"),0)
                       FROM "VoucherBatch" WHERE "userId"=%s AND source LIKE 'mikhmon_import%%'
                         AND "createdAt" >= %s""",
                    (uid, start_today),
                )
                t_b, t_v, t_r = cur.fetchone()
                cur.execute(
                    """SELECT COUNT(*), COALESCE(SUM(count),0), COALESCE(SUM("totalCost"),0)
                       FROM "VoucherBatch" WHERE "userId"=%s AND source LIKE 'mikhmon_import%%'
                         AND "createdAt" >= %s""",
                    (uid, start_month),
                )
                m_b, m_v, m_r = cur.fetchone()
                cur.execute(
                    """SELECT r.name, SUM(vb."totalCost") as rev, SUM(vb.count) as vc
                       FROM "VoucherBatch" vb JOIN "Reseller" r ON r.id = vb."resellerId"
                       WHERE vb."userId"=%s AND vb."createdAt" >= %s
                       GROUP BY r.name ORDER BY rev DESC LIMIT 5""",
                    (uid, start_month),
                )
                top_resellers = cur.fetchall()

            lines = [
                f"📊 *Laporan Penjualan*",
                f"_{now.strftime('%d %b %Y · WITA')}_\n",
                f"📅 *Hari Ini*",
                f"   Voucher: {int(t_v):,}".replace(",", "."),
                f"   Pendapatan: *{format_rp(int(t_r))}*\n",
                f"📆 *Bulan Ini*",
                f"   Voucher: {int(m_v):,}".replace(",", "."),
                f"   Pendapatan: *{format_rp(int(m_r))}*\n",
            ]
            if top_resellers:
                lines.append(f"🏆 *Top Reseller Bulan Ini*")
                for i, (name, rev, vc) in enumerate(top_resellers, 1):
                    lines.append(f"   {i}. {name} — {format_rp(int(rev))} ({int(vc)} voucher)")
            await msg.reply_text("\n".join(lines), parse_mode="Markdown")
        except Exception as exc:
            logger.error("/report error: %s", exc)
            await msg.reply_text(f"⚠️ Error: {exc}")

    async def cmd_broadcast(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin: broadcast pesan ke semua reseller (boleh dgn foto reply).
        Format: /broadcast <pesan...>  (atau reply ke foto + caption /broadcast)"""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only.")
            return

        msg = update.message
        text = " ".join(context.args or []).strip()
        photo_file_id = None
        if msg.reply_to_message and msg.reply_to_message.photo:
            photo_file_id = msg.reply_to_message.photo[-1].file_id
            if not text:
                text = msg.reply_to_message.caption or ""

        if not text and not photo_file_id:
            await msg.reply_text(
                "Format:\n"
                "  `/broadcast <pesan>` — kirim teks ke semua reseller\n"
                "  Reply ke foto + `/broadcast <caption>` — kirim foto + caption",
                parse_mode="Markdown",
            )
            return

        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT id FROM "User" WHERE "telegramId" = %s', (telegram_id,))
            row = cur.fetchone()
            if not row:
                await msg.reply_text("⚠️ User tidak ditemukan."); return
            uid = row[0]
            cur.execute(
                'SELECT name, "telegramId" FROM "Reseller" WHERE "userId" = %s AND "telegramId" != %s',
                (uid, ""),
            )
            resellers = cur.fetchall()

        if not resellers:
            await msg.reply_text("⚠️ Belum ada reseller dengan Telegram ID terdaftar.")
            return

        sent = 0; failed = 0
        bot = msg.get_bot()
        for name, tg in resellers:
            if not tg or not str(tg).strip(): continue
            try:
                if photo_file_id:
                    await bot.send_photo(
                        chat_id=int(tg), photo=photo_file_id,
                        caption=f"📢 *Pengumuman*\n\n{text}", parse_mode="Markdown",
                    )
                else:
                    await bot.send_message(
                        chat_id=int(tg),
                        text=f"📢 *Pengumuman*\n\n{text}", parse_mode="Markdown",
                    )
                sent += 1
            except Exception as exc:
                logger.warning("Broadcast to %s (%s) failed: %s", name, tg, exc)
                failed += 1

        await msg.reply_text(
            f"📢 Broadcast selesai\n\n"
            f"✅ Terkirim: {sent}\n"
            f"❌ Gagal: {failed}\n"
            f"Total: {len(resellers)}",
        )

    async def cmd_topup(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin wizard: top up saldo reseller. Pilih reseller → input amount."""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only.")
            return
        await self._wizard_topup_topdown(update, context, "topup")

    async def cmd_topdown(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Admin wizard: kurangi saldo reseller."""
        telegram_id = str(update.effective_user.id)
        if not self._is_owner(telegram_id):
            await update.message.reply_text("⛔ Admin only.")
            return
        await self._wizard_topup_topdown(update, context, "topdown")

    async def _wizard_topup_topdown(self, update, context, action: str) -> None:
        telegram_id = str(update.effective_user.id)
        await self._wizard_admin_select_reseller(update.message, telegram_id, action)

    async def _wizard_admin_select_reseller(self, msg, telegram_id: str, action: str) -> None:
        """Show daftar reseller dengan inline button. Reusable dari /topup atau button shortcut."""
        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT id FROM "User" WHERE "telegramId" = %s', (telegram_id,))
            row = cur.fetchone()
            if not row:
                await msg.reply_text("⚠️ User tidak ditemukan."); return
            uid = row[0]
            cur.execute(
                'SELECT id, name, balance FROM "Reseller" WHERE "userId" = %s ORDER BY name',
                (uid,),
            )
            resellers = cur.fetchall()
        if not resellers:
            await msg.reply_text("⚠️ Belum ada reseller. Tambah dulu via dashboard."); return
        buttons = [
            [InlineKeyboardButton(f"{n} · {format_rp(b)}", callback_data=f"wiz|{action}|sel|{rid}")]
            for rid, n, b in resellers[:30]
        ]
        buttons.append([InlineKeyboardButton("❌ Batal", callback_data="menu")])
        verb = "Top Up" if action == "topup" else "Top Down"
        await msg.reply_text(
            f"💰 *{verb} Saldo Reseller*\n\nPilih reseller:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    async def _wizard_select_reseller(self, query, context, action: str, reseller_id: str) -> None:
        """Step 2: tampilkan saldo current + prompt input amount."""
        with self.vdb._conn() as conn:
            cur = conn.cursor()
            cur.execute('SELECT name, balance FROM "Reseller" WHERE id = %s', (reseller_id,))
            row = cur.fetchone()
        if not row:
            await query.edit_message_text("Reseller tidak ditemukan."); return
        name, balance = row
        context.user_data["awaiting"] = ("wiz_amount", {"action": action, "reseller_id": reseller_id, "name": name, "balance": balance})
        verb = "Top Up" if action == "topup" else "Top Down"
        await query.edit_message_text(
            f"💰 *{verb} {name}*\n\n"
            f"Saldo sekarang: *{format_rp(balance)}*\n\n"
            f"Ketik nominal {verb.lower()} (Rp):",
            parse_mode="Markdown",
        )

    async def _wizard_execute(self, msg, context, payload: dict, amount: int) -> None:
        """Step 3: execute top up / down dengan amount yang diketik admin."""
        action = payload["action"]
        reseller_id = payload["reseller_id"]
        name = payload["name"]
        balance_before = payload["balance"]
        try:
            if action == "topup":
                tx = self.vdb.add_saldo(reseller_id, amount, description="Manual top up via bot (admin)")
                emoji = "✅"
                verb = "Top Up"
            else:
                tx = self.vdb.deduct_saldo(reseller_id, amount, description="Manual top down via bot (admin)")
                emoji = "⚠️"
                verb = "Top Down"
            balance_after = tx["balanceAfter"]
            await msg.reply_text(
                f"{emoji} *{verb} {format_rp(amount)} sukses*\n\n"
                f"Reseller: {name}\n"
                f"Saldo: {format_rp(balance_before)} → *{format_rp(balance_after)}*",
                parse_mode="Markdown",
            )
            # Notif reseller (kalau ada telegramId)
            with self.vdb._conn() as conn:
                cur = conn.cursor()
                cur.execute('SELECT "telegramId" FROM "Reseller" WHERE id = %s', (reseller_id,))
                r = cur.fetchone()
                if r and r[0]:
                    try:
                        await msg.get_bot().send_message(
                            chat_id=int(r[0]),
                            text=f"{emoji} Saldo Anda di-{verb.lower()} *{format_rp(amount)}*.\n"
                                 f"Saldo baru: *{format_rp(balance_after)}*",
                            parse_mode="Markdown",
                        )
                    except Exception: pass
        except Exception as exc:
            await msg.reply_text(f"⚠️ Error: {exc}")

    # ── Build & run ───────────────────────────────────────────

    def build_application(self) -> "Application":
        """Build a python-telegram-bot Application with handlers."""
        app = Application.builder().token(self.bot_token).build()

        # Reseller commands
        app.add_handler(CommandHandler("start", self.start_command))
        app.add_handler(CommandHandler("menu", self.cmd_menu))
        app.add_handler(CommandHandler("ceksaldo", self.cmd_ceksaldo))
        app.add_handler(CommandHandler("deposit", self.cmd_deposit))
        app.add_handler(CommandHandler("daftar", self.cmd_daftar))
        app.add_handler(CommandHandler("cek", self.cmd_cek))
        app.add_handler(CommandHandler("qrcode", self.cmd_qrcode))

        # AI Assistant (owner only)
        app.add_handler(CommandHandler("ai", self.cmd_ai))
        app.add_handler(CommandHandler("stopai", self.cmd_stopai))

        # Admin commands
        app.add_handler(CommandHandler("topup", self.cmd_topup))
        app.add_handler(CommandHandler("topdown", self.cmd_topdown))
        app.add_handler(CommandHandler("resource", self.cmd_resource))
        app.add_handler(CommandHandler("netwatch", self.cmd_netwatch))
        app.add_handler(CommandHandler("report", self.cmd_report))
        app.add_handler(CommandHandler("broadcast", self.cmd_broadcast))

        # Callback (inline buttons) + state-based message handler
        app.add_handler(CallbackQueryHandler(self.handle_callback))
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        app.add_handler(MessageHandler(filters.COMMAND & filters.Regex(r"^/skip"), self.handle_message))
        app.add_handler(MessageHandler(filters.PHOTO, self.handle_message))
        return app


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

async def _register_bot_commands(app: "Application") -> None:
    """Set tombol command list di Telegram (yg muncul saat user tap '/' di kolom chat)."""
    from telegram import BotCommand
    commands = [
        BotCommand("menu", "Menu utama"),
        BotCommand("ai", "Chat dengan AI Assistant"),
        BotCommand("stopai", "Akhiri sesi AI"),
        BotCommand("ceksaldo", "Cek saldo (reseller)"),
        BotCommand("deposit", "Request deposit (reseller)"),
        BotCommand("daftar", "Daftar sebagai reseller"),
        BotCommand("cek", "Cek status hotspot user — /cek <username>"),
        BotCommand("qrcode", "Generate QR voucher — /qrcode <user> [pwd]"),
        BotCommand("report", "Penjualan hari ini & bulan (admin)"),
        BotCommand("resource", "Resource MikroTik (admin)"),
        BotCommand("netwatch", "Netwatch host monitoring (admin)"),
        BotCommand("topup", "Top up saldo reseller (admin)"),
        BotCommand("topdown", "Kurangi saldo reseller (admin)"),
        BotCommand("broadcast", "Broadcast pesan (admin)"),
    ]
    try:
        await app.bot.set_my_commands(commands)
        logger.info("Bot commands registered (%d)", len(commands))
    except Exception as exc:
        logger.warning("Failed to register bot commands: %s", exc)


def _run_bot_in_thread(app: "Application") -> None:
    """Run a single bot Application in its own asyncio event loop (blocking)."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(app.initialize())
        loop.run_until_complete(_register_bot_commands(app))
        loop.run_until_complete(app.start())
        loop.run_until_complete(app.updater.start_polling(drop_pending_updates=True))
        logger.info("Reseller bot started polling (token ...%s)", app.bot.token[-6:])
        loop.run_forever()
    except Exception as exc:
        logger.error("Reseller bot crashed: %s", exc, exc_info=True)
    finally:
        try:
            loop.run_until_complete(app.updater.stop())
            loop.run_until_complete(app.stop())
            loop.run_until_complete(app.shutdown())
        except Exception:
            pass
        loop.close()


def start_reseller_bots() -> list[threading.Thread]:
    """Query DB for all users with resellerBotToken, start a bot for each.

    Returns list of started daemon threads (one per bot).
    """
    if not _PTB_AVAILABLE:
        logger.warning("python-telegram-bot not available -- skipping reseller bots")
        return []

    users = _get_users_with_bot_token()
    if not users:
        logger.info("No users with resellerBotToken configured -- no reseller bots to start")
        return []

    vdb = VoucherDB(DATABASE_URL)
    threads: list[threading.Thread] = []

    for user in users:
        token = user["resellerBotToken"]
        owner_tid = user["telegramId"]
        logger.info("Starting reseller bot for owner telegramId=%s", owner_tid)

        bot = ResellerBot(bot_token=token, owner_telegram_id=owner_tid, vdb=vdb)
        app = bot.build_application()

        t = threading.Thread(
            target=_run_bot_in_thread,
            args=(app,),
            daemon=True,
            name=f"reseller-bot-{owner_tid}",
        )
        t.start()
        threads.append(t)

    logger.info("Started %d reseller bot(s)", len(threads))
    return threads


# ---------------------------------------------------------------------------
# Standalone entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    threads = start_reseller_bots()
    if threads:
        # Keep main thread alive while daemon threads run
        try:
            for t in threads:
                t.join()
        except KeyboardInterrupt:
            logger.info("Shutting down reseller bots...")
    else:
        logger.info("No reseller bots to run. Exiting.")
