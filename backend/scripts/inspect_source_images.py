from PIL import Image
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
files = [
    "mahalakshmi-temple-gold-jhumkas.jpg",
    "aranya-lakshmi-choker-jhumka-set.jpg",
    "royal-pearl-cascade-necklace-set.jpg",
    "gulabi-kundan-pearl-chandbali.jpg",
    "aranya-jhumka-cropped.png",
    "aranya-jhumka-tryon.png",
    "solstice-pearl-drop-tryon.png"
]

for f in files:
    p = os.path.join(uploads_dir, f)
    if os.path.exists(p):
        im = Image.open(p)
        print(f"{f}: size={im.size}, mode={im.mode}")
