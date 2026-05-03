"""
Deploy Google OAuth ke VPS.

Jalankan SETELAH dapat GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET dari Google Cloud Console:
  Authorized redirect URI: https://app.mikrotikai.my.id/api/auth/callback/google

Usage:
  python deploy_google_oauth.py <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>
"""
import paramiko, sys, io, time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

if len(sys.argv) < 3:
    print('Usage: python deploy_google_oauth.py <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>')
    sys.exit(1)

GOOGLE_CLIENT_ID = sys.argv[1]
GOOGLE_CLIENT_SECRET = sys.argv[2]

VPS_HOST = '103.67.244.215'
VPS_USER = 'root'
VPS_PASS = 'Mant4pmentongd33!'
PROJECT_DIR = '/opt/mikrotik-ai-cloud'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'Connecting to {VPS_HOST}...')
client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)
client.get_transport().set_keepalive(15)

def cmd(command, label=''):
    print(f'\n>>> {label or command[:80]}')
    chan = client.get_transport().open_session()
    chan.settimeout(300)
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
    return chan.recv_exit_status()

# Baca .env existing
print('\n=== 1. Update .env ===')
chan = client.get_transport().open_session()
chan.exec_command(f'cat {PROJECT_DIR}/.env')
env_bytes = b''
while True:
    if chan.recv_ready(): env_bytes += chan.recv(4096)
    if chan.exit_status_ready() and not chan.recv_ready(): break
    time.sleep(0.1)
env_text = env_bytes.decode('utf-8', errors='replace')

ENV_UPDATES = {
    'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET,
}

lines = env_text.splitlines()
updated_keys = set()
new_lines = []
for line in lines:
    key = line.split('=')[0].strip()
    if key in ENV_UPDATES:
        new_lines.append(f'{key}={ENV_UPDATES[key]}')
        updated_keys.add(key)
        print(f'  Updated: {key}')
    else:
        new_lines.append(line)

for key, val in ENV_UPDATES.items():
    if key not in updated_keys:
        new_lines.append(f'{key}={val}')
        print(f'  Added: {key}')

new_env = '\n'.join(new_lines) + '\n'
sftp = client.open_sftp()
sftp.putfo(io.BytesIO(new_env.encode()), f'{PROJECT_DIR}/.env')
sftp.close()
print('  .env updated')

print('\n=== 2. Push kode terbaru ===')
cmd(f'cd {PROJECT_DIR} && git pull origin main 2>&1 | tail -5', 'git pull')

print('\n=== 3. Rebuild dashboard ===')
cmd(
    f'cd {PROJECT_DIR} && docker compose up -d --build dashboard 2>&1 | tail -10',
    'docker compose build + up dashboard'
)

print('\n=== 4. Cek health ===')
time.sleep(5)
cmd('curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/login && echo', 'health check')

print(f'''
============================================================
SELESAI!

Google OAuth aktif di: https://app.mikrotikai.my.id

Test: klik "Lanjutkan dengan Google" di halaman login.
  - Email terdaftar di DB → masuk
  - Email tidak terdaftar → redirect ke /login?error=not_registered
============================================================
''')

client.close()
