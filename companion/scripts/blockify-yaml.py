#!/usr/bin/env python3
"""Rewrite one-line prose fields (`hint: …`) as block scalars (`hint: |`).

Prose in the annotation files is full of colons, braces and quotes, which YAML
plain scalars cannot hold safely. Run over a file after editing:
    python3 scripts/blockify-yaml.py src/content/book1/*.yaml
"""
import re, sys
KEYS = r"(hint|did|fact|justification|follows|implicit|modern|gap|dispute|paraphrase|meaning|notes|interpretations|commentary|gaps|historical|caption|preamble|closing|figureCaption|title_note)"
pat = re.compile(r"^(\s*(?:- )?)" + KEYS + r": (?![|>\"'\[])(.+)$")
for path in sys.argv[1:]:
    out = []
    for line in open(path):
        m = pat.match(line.rstrip("\n"))
        if m:
            lead, key, val = m.groups()
            ind = " " * (len(lead) + 2)
            out.append(f"{lead}{key}: |\n{ind}{val}\n")
        else:
            out.append(line)
    open(path, "w").write("".join(out))
