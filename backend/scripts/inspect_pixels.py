from PIL import Image
import numpy as np
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
for f in ["mahalakshmi-temple-gold-jhumkas.jpg", "gulabi-kundan-pearl-chandbali.jpg", "aranya-lakshmi-choker-jhumka-set.jpg", "royal-pearl-cascade-necklace-set.jpg"]:
    p = os.path.join(uploads_dir, f)
    im = Image.open(p).convert("RGB")
    data = np.array(im)
    print(f, "top-left (0,0):", data[0,0], "center (h/2, w/2):", data[im.height//2, im.width//2], "bottom-right:", data[-1,-1])
