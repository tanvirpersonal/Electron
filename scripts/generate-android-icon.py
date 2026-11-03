from pathlib import Path
import cairosvg

root = Path("android/app/src/main/res")
full_svg = Path("public/icon.svg").read_bytes()
foreground_svg = Path("public/icon-foreground.svg").read_bytes()
densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in densities.items():
    folder = root / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=full_svg, write_to=str(folder / "ic_launcher.png"), output_width=size, output_height=size)
    fg_size = size * 9 // 4
    cairosvg.svg2png(bytestring=foreground_svg, write_to=str(folder / "ic_launcher_foreground.png"), output_width=fg_size, output_height=fg_size)

adaptive = root / "mipmap-anydpi-v26"
adaptive.mkdir(parents=True, exist_ok=True)
(adaptive / "ic_launcher.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n''')
values = root / "values"
values.mkdir(parents=True, exist_ok=True)
color_file = values / "ic_launcher_background.xml"
color_file.write_text('''<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#08080C</color></resources>\n''')
print("Generated Electron launcher icons for all Android densities")
