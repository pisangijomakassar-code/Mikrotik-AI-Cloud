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
        try:
            reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        except Exception as exc:
            logger.error("DB error in /start: %s", exc)
            await update.message.reply_text("Terjadi kesalahan. Coba lagi nanti.")
            return

        if not reseller:
            await update.message.reply_text(self.t("bot_text_not_registered"))
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
            conn = reg.resolve(owner_tid, None)
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

    # ── Build & run ───────────────────────────────────────────

    def build_application(self) -> "Application":
        """Build a python-telegram-bot Application with handlers."""
        app = Application.builder().token(self.bot_token).build()
        app.add_handler(CommandHandler("start", self.start_command))
        app.add_handler(CallbackQueryHandler(self.handle_callback))
        # Text + Photo handler untuk state-based input (qty buy, custom deposit, photo bukti)
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        app.add_handler(MessageHandler(filters.COMMAND & filters.Regex(r"^/skip"), self.handle_message))
        app.add_handler(MessageHandler(filters.PHOTO, self.handle_message))
        return app


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def _run_bot_in_thread(app: "Application") -> None:
    """Run a single bot Application in its own asyncio event loop (blocking)."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(app.initialize())
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
