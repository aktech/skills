"""Checks every skills/<name>/ folder: valid front matter, and nothing personal or machine-specific."""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parents[2]
errors = []
skills = sorted(p for p in (root / "skills").iterdir() if p.is_dir())
if not skills:
    errors.append("no skills found in skills/")

for skill in skills:
    md = skill / "SKILL.md"
    if not md.exists():
        errors.append(f"{skill.name}: no SKILL.md")
        continue
    head = re.match(r"^---\n(.*?)\n---\n", md.read_text(), re.S)
    if not head:
        errors.append(f"{skill.name}: SKILL.md has no front matter")
        continue
    fields = dict(re.findall(r"^(\w+):\s*(.+)$", head.group(1), re.M))
    if fields.get("name") != skill.name:
        errors.append(f"{skill.name}: front matter name is {fields.get('name')!r}, expected the folder name")
    if not 20 <= len(fields.get("description", "")) <= 1024:
        errors.append(f"{skill.name}: description missing or longer than 1024 characters")

    for f in skill.rglob("*"):
        if not f.is_file() or f.suffix in {".woff2", ".png", ".jpg", ".mp3", ".wav"}:
            continue
        text = f.read_text(errors="ignore")
        rel = f.relative_to(root)
        for n, line in enumerate(text.splitlines(), 1):
            if re.search(r"/Users/\w|/home/(?!tester\b)\w", line):
                errors.append(f"{rel}:{n}: absolute home path")
            for email in re.findall(r"[\w.+-]+@[A-Za-z][\w-]*(?:\.[A-Za-z]{2,})+\b", line):
                if not re.search(r"@(example\.(com|org|net)|[\w.-]*\.example)$", email) and "noreply" not in email:
                    errors.append(f"{rel}:{n}: email address {email}")
            if "—" in line or "–" in line:
                errors.append(f"{rel}:{n}: em or en dash")

print("\n".join(errors) or f"{len(skills)} skills OK")
sys.exit(1 if errors else 0)
