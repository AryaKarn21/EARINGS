"""
Aurélie Jewellery Background Removal & Alpha Isolation Engine
Preserves delicate filigree, pearls, metallic luster, gemstones, and chains
while cleanly isolating solid/studio backgrounds into transparent alpha PNGs.
Uses connected-component perimeter flood segmentation to guarantee interior
white pearls, diamonds, and reflections are never erased.
Automatically centers and proportions individual earrings for Virtual Try-On.
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter

def isolate_background(
    input_path,
    output_path,
    tolerance=32,
    feather_radius=1.2,
    pad_ratio=0.08,
    is_stud=False,
    isolate_individual=True
):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # 1. Load image
    pil_im = Image.open(input_path)
    
    # Check if already RGBA with existing transparent background
    if pil_im.mode == "RGBA":
        alpha_channel = np.array(pil_im.split()[-1])
        h_a, w_a = alpha_channel.shape
        border_mask = np.zeros_like(alpha_channel, dtype=bool)
        border_mask[:max(2, int(h_a * 0.02)), :] = True
        border_mask[-max(2, int(h_a * 0.02)):, :] = True
        border_mask[:, :max(2, int(w_a * 0.02))] = True
        border_mask[:, -max(2, int(w_a * 0.02)):] = True
        
        # If over 50% of the border pixels are transparent, it's already transparent!
        if np.mean(alpha_channel[border_mask] == 0) > 0.5:
            rgba = np.array(pil_im)
            alpha = rgba[:, :, 3]
            return format_and_save(rgba[:, :, :3], alpha, output_path, pad_ratio, is_stud, isolate_individual)

    im_rgb = pil_im.convert("RGB")
    w, h = im_rgb.size
    rgb = np.array(im_rgb, dtype=np.uint8)

    # 2. Sample perimeter margins (outer 3% of width and height)
    margin_y = max(3, int(h * 0.03))
    margin_x = max(3, int(w * 0.03))

    top = rgb[:margin_y, :, :].reshape(-1, 3)
    bottom = rgb[-margin_y:, :, :].reshape(-1, 3)
    left = rgb[:, :margin_x, :].reshape(-1, 3)
    right = rgb[:, -margin_x:, :].reshape(-1, 3)
    perimeter_pixels = np.concatenate([top, bottom, left, right], axis=0)

    # Compute median and mean brightness of perimeter background
    bg_median = np.median(perimeter_pixels, axis=0)
    bg_mean_lum = float(np.mean(bg_median))

    # Euclidean color distance map from perimeter median
    diff = np.sqrt(np.sum((rgb.astype(np.float32) - bg_median.astype(np.float32)) ** 2, axis=2))

    # Adaptive background candidate threshold
    if bg_mean_lum > 190:
        # Distance under tolerance OR near-white brightness
        lum = np.mean(rgb.astype(np.float32), axis=2)
        min_channel = np.min(rgb, axis=2)
        is_bg_candidate = (diff < tolerance) | (lum > 236) | (min_channel > 230)
    else:
        bg_std = np.std(perimeter_pixels, axis=0)
        eff_tol = max(tolerance, float(np.mean(bg_std) * 2.5))
        is_bg_candidate = (diff < eff_tol)

    # 3. Perimeter Connected Component Flood Fill
    # Only pixels connected to the outer edge of the image can be outer background.
    # Interior white pearls, diamonds, light stones, reflections are completely protected!
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    mask[1:-1, 1:-1] = (~is_bg_candidate).astype(np.uint8)

    # Flood fill from all border points
    flood_val = 2
    step = max(1, min(w, h) // 120)
    for x in range(0, w, step):
        if is_bg_candidate[0, x] and mask[1, x + 1] == 0:
            cv2.floodFill(mask, None, (x + 1, 1), flood_val)
        if is_bg_candidate[h - 1, x] and mask[h, x + 1] == 0:
            cv2.floodFill(mask, None, (x + 1, h), flood_val)
    for y in range(0, h, step):
        if is_bg_candidate[y, 0] and mask[y + 1, 1] == 0:
            cv2.floodFill(mask, None, (1, y + 1), flood_val)
        if is_bg_candidate[y, w - 1] and mask[y + 1, w] == 0:
            cv2.floodFill(mask, None, (w, y + 1), flood_val)

    # All flooded pixels are external background
    is_outer_bg = (mask[1:-1, 1:-1] == flood_val)

    # 4. Generate initial alpha channel
    alpha = np.ones((h, w), dtype=np.uint8) * 255
    alpha[is_outer_bg] = 0

    # 5. Clean up small floating dust or noise in background
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)

    return format_and_save(rgb, alpha, output_path, pad_ratio, is_stud, isolate_individual)

def format_and_save(rgb, alpha, output_path, pad_ratio=0.08, is_stud=False, isolate_individual=True):
    h, w = alpha.shape
    
    # 6. Check for individual earring extraction if there's a pair
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats((alpha > 128).astype(np.uint8), connectivity=8)
    selected_mask = np.zeros_like(alpha, dtype=bool)
    
    if num_labels > 1:
        fg_components = []
        for label in range(1, num_labels):
            area = stats[label, cv2.CC_STAT_AREA]
            if area > 400: # Filter small speckles
                fg_components.append((label, area, stats[label]))
        
        fg_components.sort(key=lambda c: c[1], reverse=True)
        
        if isolate_individual and len(fg_components) >= 2:
            c1, c2 = fg_components[0], fg_components[1]
            ratio = c2[1] / max(1, c1[1])
            x1, y1, w1, h1 = c1[2][0], c1[2][1], c1[2][2], c1[2][3]
            x2, y2, w2, h2 = c2[2][0], c2[2][1], c2[2][2], c2[2][3]
            
            # If two earrings side by side with comparable area
            if ratio > 0.45 and (abs(x1 - x2) > min(w1, w2) * 0.4):
                # Isolate the cleaner/left earring for Virtual Try-On
                chosen = c1 if x1 < x2 else c2
                selected_mask = (labels == chosen[0])
            else:
                for c in fg_components:
                    selected_mask |= (labels == c[0])
        elif fg_components:
            for c in fg_components:
                selected_mask |= (labels == c[0])
        else:
            selected_mask = (alpha > 0)
    else:
        selected_mask = (alpha > 0)

    final_alpha = np.where(selected_mask, alpha, 0).astype(np.uint8)

    # 7. Edge antialiasing with smooth feathering
    pil_alpha = Image.fromarray(final_alpha, mode="L")
    pil_alpha_blur = pil_alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
    smooth_alpha = np.array(pil_alpha_blur, dtype=np.uint8)
    smooth_alpha[final_alpha == 255] = np.maximum(smooth_alpha[final_alpha == 255], 240)
    smooth_alpha[final_alpha == 0] = np.minimum(smooth_alpha[final_alpha == 0], 10)
    smooth_alpha[smooth_alpha < 10] = 0
    smooth_alpha[smooth_alpha > 245] = 255

    # 8. Find bounding box of foreground
    rows = np.any(smooth_alpha > 15, axis=1)
    cols = np.any(smooth_alpha > 15, axis=0)
    
    if not np.any(rows) or not np.any(cols):
        bbox = (0, 0, w, h)
    else:
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        bbox = (xmin, ymin, xmax + 1, ymax + 1)

    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    cropped_rgb = rgb[bbox[1]:bbox[3], bbox[0]:bbox[2]]
    cropped_alpha = smooth_alpha[bbox[1]:bbox[3], bbox[0]:bbox[2]]

    # 9. Center in a square transparent canvas
    max_dim = max(cw, ch)
    pad = int(max_dim * pad_ratio)
    canvas_size = max_dim + pad * 2
    
    out_rgba = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)
    off_x = (canvas_size - cw) // 2
    
    if is_stud:
        off_y = (canvas_size - ch) // 2
    else:
        # Hanging earrings / drops / jhumkas: anchor near top with padding
        off_y = pad

    out_rgba[off_y:off_y + ch, off_x:off_x + cw, :3] = cropped_rgb
    out_rgba[off_y:off_y + ch, off_x:off_x + cw, 3] = cropped_alpha

    # 10. Save transparent PNG
    result_img = Image.fromarray(out_rgba, mode="RGBA")
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    result_img.save(output_path, "PNG", optimize=True)
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python isolate_jewellery_background.py <input> <output> [tolerance] [is_stud]")
        sys.exit(1)

    in_file = sys.argv[1]
    out_file = sys.argv[2]
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 32
    is_stud_flag = sys.argv[4].lower() in ("true", "1", "stud") if len(sys.argv) > 4 else False

    isolate_background(in_file, out_file, tolerance=tol, is_stud=is_stud_flag)
    print(f"Successfully processed {in_file} -> {out_file}")
