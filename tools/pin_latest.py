"""把 install/ 里的书海外链正则与仓库根目录 latest.json 固定到给定的完整 Commit SHA。

外链只允许完整 Commit SHA 的 GitHub raw 地址（不会随 main 变化）：
  https://raw.githubusercontent.com/Adirm007/Protelysion/<40位SHA>/site/
由 .github/workflows/pin-latest.yml 在每次推送后自动运行；本地手动：
  python3 tools/pin_latest.py <40位SHA>
已装旧版正则的用户加载时会读取 main 上的 latest.json，发现新版本后弹窗提醒改版本号（可一键替换）。
"""
import json
import pathlib
import re
import sys

REPO = 'Adirm007/Protelysion'
ROOT = pathlib.Path(__file__).resolve().parents[1]
REGEX = ROOT / 'install' / '普罗泰利西翁-书海外链加载正则.json'
BASE_RE = re.compile(r'const base="https://[^"]*"')


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'[0-9a-f]{40}', sys.argv[1].strip().lower()):
        raise SystemExit('用法：python3 tools/pin_latest.py <40位完整 Commit SHA>')
    sha = sys.argv[1].strip().lower()
    base = f'https://raw.githubusercontent.com/{REPO}/{sha}/site/'
    manifest = json.loads((ROOT / 'site' / 'release-manifest.json').read_text(encoding='utf-8'))
    revision = str(manifest.get('revision', ''))
    m = re.search(r'(\d+\.\d+\.\d+)', revision)
    if not m:
        raise SystemExit('release-manifest.json 的 revision 里没有版本号：' + revision)

    item = json.loads(REGEX.read_text(encoding='utf-8'))
    key = 'replaceString' if 'replaceString' in item else 'replace_string'
    text = item[key]
    if len(BASE_RE.findall(text)) != 1:
        raise SystemExit('外链正则里应当恰好有一处 const base="…"')
    item[key] = BASE_RE.sub('const base="' + base + '"', text)
    REGEX.write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    latest = {'schema': 1, 'name': 'protelysion', 'version': m.group(1), 'revision': revision,
              'sha': sha, 'content': 0, 'base': base}
    (ROOT / 'latest.json').write_text(json.dumps(latest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('pinned', m.group(1), sha)


if __name__ == '__main__':
    main()
