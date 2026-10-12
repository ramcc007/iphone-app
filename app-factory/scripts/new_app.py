#!/usr/bin/env python3
"""Creates a new app repository folder from the app-factory template.

  python3 scripts/new_app.py --name "NumFall" --target Numfall --domain numfall.store \
      --tagline "Drop the numbers. Beat the clock." --genre Puzzle \
      --category public.app-category.puzzle-games --out ../numfall

--name      Display / store name (spelling used everywhere)
--target    Xcode target and Swift module name: letters and digits only, starts with a capital (e.g. Numfall)
--domain    The app's own domain without www (bundle ID becomes its reverse + ".app": numfall.store -> store.numfall.app)
--genre     Short genre word for structured data (Puzzle, Strategy, Word, Arcade...)
--category  Apple LSApplicationCategoryType (public.app-category.puzzle-games, strategy-games, word-games, board-games...)
--out       Empty or new folder to write into

Afterwards: create ios/<Target>/ and ios/<Target>Core/ (copy patterns from the reference repo), rewrite site pages,
fill tools/ci/scenes.txt and tools/appstore/shots.json, then push to the new GitHub repo.
"""
import argparse, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "template")
BINARY = (".ttf", ".png", ".ico", ".jpg", ".woff2")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for a in ("name", "target", "domain", "tagline", "genre", "category", "out"):
        p.add_argument("--" + a, required=True)
    a = p.parse_args()
    if not re.fullmatch(r"[A-Z][A-Za-z0-9]{1,30}", a.target):
        sys.exit("--target must be letters/digits starting with a capital, e.g. Numfall")
    if len(a.name) > 30:
        sys.exit("--name is over 30 characters (App Store limit)")
    domain = a.domain.lower().removeprefix("www.")
    prefix = ".".join(reversed(domain.split(".")))
    values = {
        "APP_NAME": a.name, "TARGET": a.target, "DOMAIN": domain, "DOMAIN_WWW": "www." + domain,
        "BUNDLE_PREFIX": prefix, "BUNDLE_ID": prefix + ".app", "TAGLINE": a.tagline,
        "GENRE": a.genre, "APP_CATEGORY": a.category,
    }
    if os.path.exists(a.out) and os.listdir(a.out):
        existing = set(os.listdir(a.out)) - {".git", "README.md", "LICENSE"}
        if existing:
            sys.exit(f"{a.out} is not empty: {sorted(existing)[:5]}")
    for root, dirs, files in os.walk(TEMPLATE):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            src = os.path.join(root, f)
            rel = os.path.relpath(src, TEMPLATE)
            rel = rel.replace("CLAUDE.md.template", "CLAUDE.md")
            if rel == os.path.join("ios", "PrivacyInfo.xcprivacy"):
                rel = os.path.join("ios", a.target, "Resources", "PrivacyInfo.xcprivacy")
            dst = os.path.join(a.out, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if f.endswith(BINARY):
                shutil.copyfile(src, dst)
                continue
            text = open(src, encoding="utf-8").read()
            text = re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: values.get(m.group(1), m.group(0)), text)
            open(dst, "w", encoding="utf-8").write(text)
            shutil.copymode(src, dst)
    left = []
    for root, _, files in os.walk(a.out):
        for f in files:
            if f.endswith(BINARY):
                continue
            path = os.path.join(root, f)
            try:
                for m in re.finditer(r"\{\{([A-Z_]+)\}\}", open(path, encoding="utf-8").read()):
                    left.append(f"{os.path.relpath(path, a.out)}: {m.group(0)}")
            except UnicodeDecodeError:
                pass
    print(f"Created {a.name} in {a.out} (bundle ID {values['BUNDLE_ID']}).")
    if left:
        print("Placeholders still to fill:\n  " + "\n  ".join(left))
    print("Next: ios/%s and ios/%sCore sources, site pages, tools/ci/scenes.txt, tools/appstore/shots.json." % (a.target, a.target))


if __name__ == "__main__":
    main()
