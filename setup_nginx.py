"""
Setup Nginx reverse proxy untuk mikrotikai.my.id di VPS.
Jalankan SETELAH:
  1. Cloudflare NS sudah aktif (cek: nslookup app.mikrotikai.my.id)
  2. A record app.mikrotikai.my.id → 103.67.244.215 sudah propagate
"""
import paramiko, sys, time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = '103.67.244.215'
VPS_USER = 'root'
VPS_PASS = 'Mant4pmentongd33!'
APP_DOMAIN = 'app.mikrotikai.my.id'
PROJECT_DIR = '/opt/mikrotik-ai-cloud'

NGINX_CONF = open('nginx/app.mikrotikai.my.id.conf').read()

# .env values yang perlu ditambah/update
ENV_UPDATES = {
    'AUTH_URL': f'https://{APP_DOMAIN}',
    'WEBHOOK_BASE_URL': f'https://{APP_DOMAIN}',
    'VPS_HOST': APP_DOMAIN,
}

def run(chan, cmd, label=''):
    print(f'\n>>> {label or cmd}')
    chan = client.get_transport().open_session()
    chan.settimeout(120)
    chan.exec_command(cmd)
    out = b''
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096)
            out += chunk
            print(chunk.decode('utf-8', errors='replace'), end='', flush=True)
        if chan.exit_status_ready() and not chan.recv_ready():
            break
        time.sleep(0.3)
    code = chan.recv_exit_status()
    if code != 0:
        print(f'  [exit={code}]')
    return code, out.decode('utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {VPS_HOST}...')
client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30, banner_timeout=30)
client.get_transport().set_keepalive(15)

def cmd(command, label=''):
    chan = client.get_transport().open_session()
    chan.settimeout(120)
    chan.exec_command(command)
    out = b''
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096)
            out += chunk
            print(chunk.decode('utf-8', errors='replace'), end='', flush=True)
        if chan.exit_status_ready() and not chan.recv_ready():
            break
        time.sleep(0.3)
    code = chan.recv_exit_status()
    return code

print('\n=== 1. Install Nginx ===')
cmd('apt-get update -qq && apt-get install -y nginx', 'install nginx')

print('\n=== 2. Deploy Nginx config ===')
sftp = client.open_sftp()
import io
sftp.putfo(io.BytesIO(NGINX_CONF.encode()), f'/etc/nginx/sites-available/{APP_DOMAIN}')
sftp.close()
print(f'  Config uploaded ke /etc/nginx/sites-available/{APP_DOMAIN}')

cmd(f'ln -sf /etc/nginx/sites-available/{APP_DOMAIN} /etc/nginx/sites-enabled/{APP_DOMAIN}')
cmd('rm -f /etc/nginx/sites-enabled/default')  # hapus default page

print('\n=== 3. Test & reload Nginx ===')
rc = cmd('nginx -t')
if rc != 0:
    print('ERROR: nginx config test gagal, abort.')
    client.close()
    sys.exit(1)
cmd('systemctl reload nginx || systemctl restart nginx')
cmd('systemctl enable nginx')
print('  Nginx OK')

print('\n=== 4. Update .env di VPS ===')
# Baca .env existing
chan = client.get_transport().open_session()
chan.exec_command(f'cat {PROJECT_DIR}/.env')
env_content = b''
while True:
    if chan.recv_ready(): env_content += chan.recv(4096)
    if chan.exit_status_ready() and not chan.recv_ready(): break
    time.sleep(0.1)
env_text = env_content.decode('utf-8', errors='replace')

# Update/tambah values
lines = env_text.splitlines()
updated_keys = set()
new_lines = []
for line in lines:
    key = line.split('=')[0].strip()
    if key in ENV_UPDATES:
        new_lines.append(f'{key}={ENV_UPDATES[key]}')
        updated_keys.add(key)
        print(f'  Updated: {key}={ENV_UPDATES[key]}')
    else:
        new_lines.append(line)

# Tambah key yang belum ada
for key, val in ENV_UPDATES.items():
    if key not in updated_keys:
        new_lines.append(f'{key}={val}')
        print(f'  Added: {key}={val}')

new_env = '\n'.join(new_lines) + '\n'
sftp = client.open_sftp()
sftp.putfo(io.BytesIO(new_env.encode()), f'{PROJECT_DIR}/.env')
sftp.close()
print('  .env updated')

print('\n=== 5. Redeploy dashboard ===')
cmd(
    f'cd {PROJECT_DIR} && '
    'git pull origin main 2>&1 | tail -3 && '
    'docker compose up -d --build dashboard 2>&1 | grep -E "(Built|Recreated|Started|Error|fail)" | tail -5',
    'git pull + rebuild dashboard'
)

print('\n=== 6. Cek Nginx status ===')
cmd('systemctl status nginx --no-pager -l | head -20')

print(f'''
============================================================
SELESAI!

Dashboard sekarang dapat diakses di:
  https://{APP_DOMAIN}

Pastikan di Cloudflare:
  - A record: app → 103.67.244.215 (Proxied 🟠)
  - SSL/TLS mode: Full

Webhook Telegram URL:
  https://{APP_DOMAIN}/api/telegram/webhook/{{routerId}}
============================================================
''')

client.close()
