from PIL import Image
import numpy as np
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
img_path = os.path.join(uploads_dir, "aranya-jhumka-tryon.png")
im = Image.open(img_path).convert("RGBA")
w, h = im.size
data = np.array(im, dtype=np.float32)
rgb = data[:, :, :3]
border_samples = np.concatenate([
    rgb[0:4, :].reshape(-1, 3),
    rgb[h-4:h, :].reshape(-1, 3),
    rgb[:, 0:4].reshape(-1, 3),
    rgb[:, w-4:w].reshape(-1, 3)
], axis=0)

bg_color = np.median(border_samples, axis=0)
color_diff = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
print("bg_color:", bg_color)
print("color_diff min/max/median:", color_diff.min(), color_diff.max(), np.median(color_diff))
print("number of pixels with color_diff < 28:", np.sum(color_diff < 28))
print("number of pixels with color_diff >= 28:", np.sum(color_diff >= 28))
print("total pixels:", w * h)
