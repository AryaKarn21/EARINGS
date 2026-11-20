import cv2
import numpy as np
import os

def isolate_jewellery_cutout(img_path, out_png_path):
    img = cv2.imread(img_path)
    if img is None:
        raise ValueError(f"Could not load image: {img_path}")
    
    h, w = img.shape[:2]
    # Convert to HSV and LAB
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    
    # In faux checkerboard: saturation is very low (S < 18) and a/b channels in LAB are close to neutral 128
    # The gold jewellery has strong saturation (S > 22) or warm hue
    # The pearls are ivory/cream with golden reflections, surrounded by gold wire
    
    # Sample background corners
    corners = [
        img[0:30, 0:30],
        img[0:30, w-30:w],
        img[h-30:h, 0:30],
        img[h-30:h, w-30:w],
        img[0:20, w//2-20:w//2+20],
    ]
    corner_samples = np.vstack([c.reshape(-1, 3) for c in corners])
    
    # Calculate saturation
    s_channel = hsv[:, :, 1]
    v_channel = hsv[:, :, 2]
    b, g, r = cv2.split(img)
    
    # Neutral checkerboard detection: |r - g| < 12 and |g - b| < 12 and |r - b| < 12
    rg_diff = np.abs(r.astype(int) - g.astype(int))
    gb_diff = np.abs(g.astype(int) - b.astype(int))
    rb_diff = np.abs(r.astype(int) - b.astype(int))
    max_color_diff = np.maximum(np.maximum(rg_diff, gb_diff), rb_diff)
    
    # Jewellery mask: gold has r > b + 15, or high saturation, or non-neutral
    # Gold and warm pearls:
    jewellery_mask = (max_color_diff > 12) | (s_channel > 20) | (r.astype(int) - b.astype(int) > 15)
    
    # Clean up with morphological closing to fill interior pearl gaps
    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    kernel_medium = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    kernel_large = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    
    mask_clean = cv2.morphologyEx(jewellery_mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel_medium)
    
    # Find outer connected background starting from edges
    bg_seed = np.zeros((h + 2, w + 2), np.uint8)
    # Inverse of mask is candidate background
    inv_mask = (1 - mask_clean).astype(np.uint8)
    
    # FloodFill from top-left, top-right, bottom-left, bottom-right, top-center
    flood = inv_mask.copy()
    cv2.floodFill(flood, None, (0, 0), 2)
    cv2.floodFill(flood, None, (w - 1, 0), 2)
    cv2.floodFill(flood, None, (0, h - 1), 2)
    cv2.floodFill(flood, None, (w - 1, h - 1), 2)
    cv2.floodFill(flood, None, (w // 2, 0), 2)
    cv2.floodFill(flood, None, (w // 2, h // 4), 2) # inner neckline opening
    
    # True background is where flood == 2
    true_bg = (flood == 2)
    
    # Foreground is NOT true background
    fg_mask = (~true_bg).astype(np.uint8) * 255
    
    # Remove small specks
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    final_mask = np.zeros((h, w), np.uint8)
    for cnt in contours:
        if cv2.contourArea(cnt) > 200:
            cv2.drawContours(final_mask, [cnt], -1, 255, -1)
            
    # Re-apply colour condition inside the final mask to remove inner checkerboard squares
    refined_mask = np.where(final_mask > 0, mask_clean * 255, 0).astype(np.uint8)
    
    # Fill small interior holes inside pearls/gemstones
    filled_mask = cv2.morphologyEx(refined_mask, cv2.MORPH_CLOSE, kernel_large)
    
    # Smooth edges with Gaussian blur to produce smooth alpha anti-aliasing
    alpha = cv2.GaussianBlur(filled_mask, (5, 5), 0)
    
    # Create RGBA image
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    
    # Crop to non-transparent bounding box with padding
    coords = cv2.findNonZero(alpha)
    x, y, bw, bh = cv2.boundingRect(coords)
    pad = 20
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(w, x + bw + pad)
    y1 = min(h, y + bh + pad)
    
    cropped_rgba = rgba[y0:y1, x0:x1]
    
    cv2.imwrite(out_png_path, cropped_rgba)
    print(f"Saved: {out_png_path} ({x1-x0}x{y1-y0})")

# Process both generated necklaces
choker_in = r"C:\Users\aryak\.gemini\antigravity-ide\brain\5e00ea36-c221-40cd-a9ae-deec8d9a4945\aranya_choker_tryon_1791975622658.jpg"
pearl_in = r"C:\Users\aryak\.gemini\antigravity-ide\brain\5e00ea36-c221-40cd-a9ae-deec8d9a4945\royal_pearl_tryon_1791975642281.jpg"

backend_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
frontend_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\frontend\public\uploads"

for dest_dir in [backend_dir, frontend_dir]:
    isolate_jewellery_cutout(choker_in, os.path.join(dest_dir, "aranya-choker-necklace-tryon.png"))
    isolate_jewellery_cutout(pearl_in, os.path.join(dest_dir, "royal-pearl-necklace-tryon.png"))
