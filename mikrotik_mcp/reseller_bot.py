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
    from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
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
                await self._show_menu(query, telegram_id)
            elif action == "saldo":
                await self._show_saldo(query, telegram_id)
            elif action == "buy":
                if len(parts) == 1:
                    await self._show_profiles(query, telegram_id)
                elif len(parts) == 2:
                    await self._confirm_buy(query, telegram_id, parts[1])
                elif len(parts) == 3 and parts[2] == "ok":
                    await self._execute_buy(query, telegram_id, parts[1])
            elif action == "deposit":
                if len(parts) == 1:
                    await self._show_deposit_amounts(query, telegram_id)
                elif len(parts) == 2:
                    await self._request_deposit(query, telegram_id, int(parts[1]))
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

    async def _confirm_buy(self, query, telegram_id: str, voucher_type_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
        if not vt or vt.get("userId") != reseller["userId"]:
            await query.edit_message_text(
                "Jenis voucher tidak ditemukan.",
                reply_markup=self._back_button(),
            )
            return

        balance = int(reseller.get("balance") or 0)
        disc = int(reseller.get("discount") or 0)
        harga = int(vt.get("harga") or 0)
        harga_jual = self._calc_reseller_price(vt, disc)
        saldo_setelah = balance - harga_jual

        disc_line = f"\n💸 Diskon ({disc}%): -{format_rp(harga - harga_jual)}" if disc > 0 else ""
        warn = "" if saldo_setelah >= 0 else "\n\n⚠️ Saldo tidak mencukupi!"

        await query.edit_message_text(
            f"Beli voucher *{vt['namaVoucher']}*?\n\n"
            f"📶 Profile: `{vt['profile']}`\n"
            f"💰 Harga: {format_rp(harga)}{disc_line}\n"
            f"💵 Bayar: *{format_rp(harga_jual)}*\n"
            f"💼 Saldo: {format_rp(balance)} → {format_rp(saldo_setelah)}{warn}",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Ya, Beli", callback_data=f"buy|{voucher_type_id}|ok"),
                    InlineKeyboardButton("❌ Batal", callback_data="menu"),
                ],
            ]),
        )

    # ── Buy: execute ──────────────────────────────────────────

    async def _execute_buy(self, query, telegram_id: str, voucher_type_id: str) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        vt = self.vdb.get_voucher_type_by_id(voucher_type_id)
        if not vt or vt.get("userId") != reseller["userId"]:
            await query.edit_message_text(
                "Jenis voucher tidak ditemukan.",
                reply_markup=self._back_button(),
            )
            return

        owner_tid = reseller.get("ownerTelegramId", self.owner_telegram_id)
        reseller_id = reseller["id"]
        disc = int(reseller.get("discount") or 0)
        price_per_unit = self._calc_reseller_price(vt, disc)
        balance = int(reseller.get("balance") or 0)

        # Pre-flight: saldo check BEFORE touching router
        if price_per_unit > 0 and balance < price_per_unit:
            await query.edit_message_text(
                f"⚠️ Saldo tidak cukup.\n"
                f"Saldo: {format_rp(balance)}\n"
                f"Butuh: {format_rp(price_per_unit)}",
                reply_markup=self._back_button(),
            )
            return

        # Resolve router
        try:
            reg = _get_registry()
            conn = reg.resolve(owner_tid, None)
        except Exception as exc:
            logger.error("Router resolve failed: %s", exc)
            await query.edit_message_text(
                "Tidak dapat terhubung ke router. Hubungi admin.",
                reply_markup=self._back_button(),
            )
            return

        # Generate voucher per VoucherType template
        prefix = vt.get("prefix") or ""
        char_len = max(3, int(vt.get("panjangKarakter") or 6))
        type_login = vt.get("typeLogin") or "Username = Password"
        charset = self._charset_for(vt.get("typeChar") or "Random abcd2345")

        username = prefix + "".join(random.choices(charset, k=char_len))
        password = username if type_login == "Username = Password" else "".join(random.choices(charset, k=char_len))
        profile_name = vt["profile"]

        try:
            with connect_router(conn["host"], conn["port"], conn["username"], conn["password"]) as api:
                existing = {u.get("name", "") for u in api.path("ip", "hotspot", "user")}
                for _ in range(10):
                    if username not in existing:
                        break
                    username = prefix + "".join(random.choices(charset, k=char_len))
                    if type_login == "Username = Password":
                        password = username
                else:
                    await query.edit_message_text(
                        "Gagal membuat username unik. Coba lagi.",
                        reply_markup=self._back_button(),
                    )
                    return

                add_params = {"name": username, "password": password, "profile": profile_name}
                server = vt.get("server") or ""
                if server and server != "all":
                    add_params["server"] = server
                limit_uptime = vt.get("limitUptime") or ""
                if limit_uptime and limit_uptime != "0":
                    add_params["limit-uptime"] = limit_uptime
                limit_total_bytes = int(vt.get("limitQuotaTotal") or 0)
                if limit_total_bytes > 0:
                    add_params["limit-bytes-total"] = str(limit_total_bytes)
                api.path("ip", "hotspot", "user").add(**add_params)
        except Exception as exc:
            logger.error("Voucher creation on router failed: %s", exc)
            await query.edit_message_text(
                "Gagal membuat voucher di router. Coba lagi nanti.",
                reply_markup=self._back_button(),
            )
            return

        # Deduct saldo (atomic). If it fails, log — voucher already on router.
        balance_after = balance
        if price_per_unit > 0:
            try:
                tx = self.vdb.deduct_saldo(
                    reseller_id, price_per_unit,
                    description=f"Voucher {vt['namaVoucher']}",
                )
                balance_after = tx["balanceAfter"]
            except ValueError as exc:
                logger.warning("Saldo deduction failed after voucher created: %s", exc)
                await query.edit_message_text(
                    f"⚠️ Voucher dibuat tapi saldo tidak cukup saat finalisasi.\n\n"
                    f"👤 *Username:* `{username}`\n"
                    f"🔑 *Password:* `{password}`\n"
                    f"📶 *Profil:* {profile_name}\n\n"
                    f"Hubungi admin: {exc}",
                    parse_mode="Markdown",
                    reply_markup=self._back_button(),
                )
                return

        # Persist batch
        try:
            self.vdb.save_batch(
                user_id=owner_tid,
                router_name=conn.get("name", ""),
                profile=profile_name,
                vouchers=[{"username": username, "password": password}],
                source="reseller_bot",
                reseller_id=reseller_id,
                price_per_unit=price_per_unit,
            )
        except Exception as exc:
            logger.warning("Failed to persist reseller voucher batch: %s", exc)

        await query.edit_message_text(
            f"✅ Voucher berhasil dibuat!\n\n"
            f"🎫 *{vt['namaVoucher']}*\n"
            f"👤 *Username:* `{username}`\n"
            f"🔑 *Password:* `{password}`\n"
            f"📶 *Profil:* {profile_name}\n"
            f"💵 Bayar: {format_rp(price_per_unit)}\n"
            f"💰 Sisa saldo: {format_rp(balance_after)}",
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
            [InlineKeyboardButton("⬅️ Menu Utama", callback_data="menu")],
        ]
        await query.edit_message_text(
            "💳 Pilih jumlah deposit:",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    # ── Deposit: send request ─────────────────────────────────

    async def _request_deposit(self, query, telegram_id: str, amount: int) -> None:
        reseller = self.vdb.get_reseller_by_telegram(telegram_id)
        if not reseller:
            await query.edit_message_text("Anda belum terdaftar. Hubungi admin.")
            return

        reseller_name = reseller.get("name", "Reseller")
        reseller_phone = reseller.get("phone", "-")
        owner_tid = reseller.get("ownerTelegramId", self.owner_telegram_id)

        # Notify owner via the bot
        try:
            bot = query.get_bot()
            await bot.send_message(
                chat_id=int(owner_tid),
                text=(
                    f"📥 *Request Deposit Baru*\n\n"
                    f"Reseller: {reseller_name}\n"
                    f"Telepon: {reseller_phone}\n"
                    f"Jumlah: {format_rp(amount)}\n"
                    f"Waktu: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
                ),
                parse_mode="Markdown",
            )
        except Exception as exc:
            logger.error("Failed to send deposit notification to owner %s: %s", owner_tid, exc)
            # Still confirm to reseller -- owner can check DB
            await query.edit_message_text(
                f"⚠️ Request deposit {format_rp(amount)} dicatat, "
                f"tapi notifikasi ke admin gagal terkirim.\n"
                f"Silakan hubungi admin langsung.",
                reply_markup=self._back_button(),
            )
            return

        await query.edit_message_text(
            f"✅ Request deposit {format_rp(amount)} telah dikirim ke admin.\n"
            f"Silakan lakukan transfer dan tunggu konfirmasi.",
            reply_markup=self._back_button(),
        )

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
