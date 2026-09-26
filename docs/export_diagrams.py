"""Export the inline SVG diagrams in docs/architecture.html to docs/diagrams/*.svg.

Each SVG gets the page's diagram styles embedded, with light and dark palettes,
so it renders on its own (GitHub, VS Code, a browser). Run from the repo root:
    python docs/export_diagrams.py
"""

import re
import xml.dom.minidom
from pathlib import Path

SOURCE = Path("docs/architecture.html")
OUT_DIR = Path("docs/diagrams")
DIAGRAMS = [
    ("1-runtime-architecture", "Runtime architecture"),
    ("2-deployment-topology", "Deployment topology"),
    ("3-deployment-pipeline", "Deployment pipeline"),
    ("4-cicd-promotion", "CI/CD and promotion"),
]
PALETTE = """:root, svg {
  --surface: #FFFFFF; --zone: #E8EDEA; --ink: #15201C; --ink-2: #4B5A54;
  --line: #BFCAC5; --accent: #0A6B63; --manual: #9C5B08;
  --font-body: "IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  svg {
    --surface: #151D1A; --zone: #1B2521; --ink: #E2EAE6; --ink-2: #9DACA6;
    --line: #36443F; --accent: #4CC3B5; --manual: #E3A24B;
  }
}
.bg { fill: var(--surface); }
"""


def main() -> None:
    src = SOURCE.read_text()
    page_css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
    diagram_css = "\n".join(
        line.replace(".d ", "") for line in page_css.splitlines() if line.strip().startswith(".d ")
    )
    svgs = re.findall(r'<svg class="d".*?</svg>', src, re.S)
    if len(svgs) != len(DIAGRAMS):
        raise SystemExit(f"Expected {len(DIAGRAMS)} diagrams in {SOURCE}, found {len(svgs)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for svg, (name, title) in zip(svgs, DIAGRAMS):
        width, height = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg).groups()
        label = re.search(r'aria-label="([^"]*)"', svg).group(1)
        body = svg.split(">", 1)[1].rsplit("</svg>", 1)[0]
        out = (
            f'<svg xmlns="http://www.w3.org/2000/svg" class="d" viewBox="0 0 {width} {height}" '
            f'width="{width}" height="{height}" role="img" aria-labelledby="t d">\n'
            f'<title id="t">anaviche-functions: {title}</title>\n<desc id="d">{label}</desc>\n'
            f"<style>\n{PALETTE}{diagram_css}\n</style>\n"
            f'<rect class="bg" x="0" y="0" width="{width}" height="{height}"/>{body}</svg>\n'
        )
        xml.dom.minidom.parseString(out.encode())  # fail on malformed SVG
        (OUT_DIR / f"{name}.svg").write_text(out)
        print(f"wrote {OUT_DIR / name}.svg")


if __name__ == "__main__":
    main()
