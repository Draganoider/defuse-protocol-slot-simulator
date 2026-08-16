"""Normalize a transparent source image for Defuse Protocol symbol slots."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS_SIZE = 512
ART_SIZE = 430


def process(source: Path, destination: Path) -> None:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
        bounds = image.getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"{source} has no visible pixels")
        image = image.crop(bounds)
        image.thumbnail((ART_SIZE, ART_SIZE), Image.Resampling.LANCZOS)

        canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
        offset = ((CANVAS_SIZE - image.width) // 2, (CANVAS_SIZE - image.height) // 2)
        canvas.alpha_composite(image, offset)

    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, "WEBP", lossless=True, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    process(args.source, args.destination)


if __name__ == "__main__":
    main()
