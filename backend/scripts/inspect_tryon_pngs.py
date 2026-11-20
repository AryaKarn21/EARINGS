from PIL import Image
import numpy as np
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
for f in ["aranya-jhumka-tryon.png", "solstice-pearl-drop-tryon.png", "gulabi-chandbali-tryon.png", "aranya-choker-necklace-tryon.png", "royal-pearl-necklace-tryon.png"]:
    p = os.path.join(uploads_dir, f)
    im = Image.open(p).convert("RGBA")
    data = np.array(im)
    rgb = data[:, :, :3]
    alpha = data[:, :, 3]
    print(f"\n{f}: shape={data.shape}")
    print(f"  corners: TL={tuple(data[0,0])}, TR={tuple(data[0,-1])}, BL={tuple(data[-1,0])}, BR={tuple(data[-1,-1])}")
    print(f"  alpha: min={alpha.min()}, max={alpha.max()}, mean={alpha.mean():.1f}")
    # where is the non-white content?
    dist_from_white = np.sqrt(np.sum((rgb.astype(float) - [255, 255, 255]) ** 2, axis=2))
    jewel_pixels = dist_from_white > 35
    print(f"  non-white pixels (dist > 35): {np.sum(jewel_pixels)} ({np.sum(jewel_pixels)*100/jewel_pixels.size:.1f}%)")
    if np.sum(jewel_pixels) > 0:
        ys, xs = np.where(jewel_pixels)
        print(f"  jewel bbox: x=[{xs.min()}, {xs.max()}], y=[{ys.min()}, {ys.max()}]")
