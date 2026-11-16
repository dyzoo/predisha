from pathlib import Path

root = Path('E:/spotibet/spotibet-app/src')
for p in sorted(root.rglob('*.ts')) + sorted(root.rglob('*.tsx')):
    try:
        t = p.read_text(encoding='utf-8')
    except Exception:
        continue
    for i, line in enumerate(t.split('\n'), 1):
        if 'sandbox' in line.lower():
            print(f'{p}:{i}: {line.strip()}')
