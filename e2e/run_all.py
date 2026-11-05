"""Runs every browser test against a production build served on :4173 (starts it if nothing is listening)."""
import os, socket, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = sys.argv[1:] or ['app_e2e.py', 'timeline_e2e.py', 'detective_e2e.py', 'challenge_e2e.py', 'profile_e2e.py']

def listening() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', 4173)) == 0

server = None
if not listening():
    if not os.path.isdir(os.path.join(ROOT, 'dist')):
        subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True)
    server = subprocess.Popen(['npx', 'vite', 'preview', '--port', '4173'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if listening(): break
        time.sleep(0.5)

failed = []
try:
    for name in SCRIPTS:
        print(f'\n######## {name}')
        proc = subprocess.Popen([sys.executable, '-u', os.path.join(HERE, name)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        bad = False
        for line in proc.stdout:  # type: ignore[union-attr]
            print(line, end='')
            if line.startswith('  FAIL') or 'Traceback' in line:
                bad = True
        if proc.wait() != 0 or bad:
            failed.append(name)
finally:
    if server: server.terminate()
print('\nSUMMARY:', 'all passed' if not failed else f'failed: {failed}')
sys.exit(1 if failed else 0)
