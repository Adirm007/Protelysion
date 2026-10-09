"""Read-only verification of original Booksea handoff, excludes new implementation/docs."""
from pathlib import Path
import hashlib
import sys
import os

root = Path(__file__).resolve().parents[2]
expected = "f928ee2eaafaa25ef02f013720b5164cf6c9ee1886390fc4a662568660710568"
# Prune owned implementation/lab trees BEFORE descent; never traverse private runtimes.
new_card = root / "02-宿主参考-只读" / "v4.3.png"
files = []
for base, dirs, names in os.walk(root, followlinks=False):
    dirs[:] = [d for d in dirs if not (Path(base) / d).is_symlink()
               and not (Path(base) == root and d in {"09-实现", "10-联调环境", "docs"})]
    for name in names:
        p = Path(base) / name
        if p != new_card and not p.is_symlink():
            files.append(p)
files.sort()
hash_tree = hashlib.sha256()
for path in files:
    relative = path.relative_to(root).as_posix()
    hash_tree.update((relative + "\0" + hashlib.sha256(path.read_bytes()).hexdigest() + "\n").encode())
actual = hash_tree.hexdigest()
print(f"ORIGINAL_FILES {len(files)} TREE_SHA256 {actual}")
if len(files) != 66 or actual != expected:
    print("MISMATCH: original handoff changed or files were added outside implementation/docs.")
    sys.exit(1)
print("PASS: all 66 original handoff files unchanged.")

if new_card.exists():
    card_hash = hashlib.sha256(new_card.read_bytes()).hexdigest()
    if card_hash != "3cfd1900fef981ebe88486ab216a855d5e952f8ff5c25a14bc4a00eeb8e1cca7":
        sys.exit("MISMATCH: newly supplied host PNG changed")
    print("PASS: newly supplied v4.3.png unchanged (verified separately).")
