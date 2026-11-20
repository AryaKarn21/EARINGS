from PIL import Image
import numpy as np
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"

def analyze_image_layout(fname):
    p = os.path.join(uploads_dir, fname)
    im = Image.open(p).convert("RGB")
    data = np.array(im, dtype=np.float32)
    # Background is white / near white
    dist_from_white = np.sqrt(np.sum((data - [255, 255, 255]) ** 2, axis=2))
    jewel_mask = dist_from_white > 25
    y_indices, x_indices = np.where(jewel_mask)
    if len(y_indices) == 0:
        print(f"{fname}: No jewellery detected")
        return
    min_x, max_x = int(np.min(x_indices)), int(np.max(x_indices))
    min_y, max_y = int(np.min(y_indices)), int(np.max(y_indices))
    print(f"\n{fname}:")
    print(f"  Overall Jewellery Bounding Box: x=[{min_x}, {max_x}] (w={max_x-min_x}), y=[{min_y}, {max_y}] (h={max_y-min_y})")
    
    # Check vertical & horizontal projection
    col_counts = np.sum(jewel_mask, axis=0)
    row_counts = np.sum(jewel_mask, axis=1)
    
    # Find separate components along columns or rows (e.g. left earring vs right earring vs center necklace)
    cols_active = np.where(col_counts > 50)[0]
    if len(cols_active) > 0:
        gaps = np.where(np.diff(cols_active) > 20)[0]
        print(f"  Horizontal splits: {len(gaps) + 1} distinct parts across width")
        curr = cols_active[0]
        for g in gaps:
            end = cols_active[g]
            print(f"    Part: x=[{curr}, {end}]")
            curr = cols_active[g+1]
        print(f"    Part: x=[{curr}, {cols_active[-1]}]")

analyze_image_layout("mahalakshmi-temple-gold-jhumkas.jpg")
analyze_image_layout("gulabi-kundan-pearl-chandbali.jpg")
analyze_image_layout("aranya-lakshmi-choker-jhumka-set.jpg")
analyze_image_layout("royal-pearl-cascade-necklace-set.jpg")
