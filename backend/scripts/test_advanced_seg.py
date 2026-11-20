import cv2
import numpy as np
from PIL import Image, ImageFilter
import os

def segment_and_isolate_jewellery(input_path, output_path, tol=28, feather=1.2, pad=10):
    im = Image.open(input_path).convert("RGBA")
    w, h = im.size
    data = np.array(im, dtype=np.uint8)
    rgb = data[:, :, :3]
    
    # 1. Sample background color from border margins (5px perimeter)
    margin = 5
    top = rgb[:margin, :, :].reshape(-1, 3)
    bottom = rgb[-margin:, :, :].reshape(-1, 3)
    left = rgb[:, :margin, :].reshape(-1, 3)
    right = rgb[:, -margin:, :].reshape(-1, 3)
    borders = np.concatenate([top, bottom, left, right], axis=0)
    bg_color = np.median(borders, axis=0) # usually [255, 255, 255] or close
    
    # 2. Compute color distance from background
    diff = np.sqrt(np.sum((rgb.astype(np.float32) - bg_color) ** 2, axis=2))
    
    # Is pixel close to background?
    # For white backgrounds, also check luminance:
    is_white_bg = (bg_color[0] + bg_color[1] + bg_color[2]) / 3.0 > 220
    if is_white_bg:
        is_bg_candidate = (diff < tol) | ((rgb[:,:,0] > 240) & (rgb[:,:,1] > 240) & (rgb[:,:,2] > 240))
    else:
        is_bg_candidate = (diff < tol)
        
    # 3. Connected component flood fill from image perimeter
    # Anything connected to the image outer edge that is bg_candidate is outer background.
    # Anything inside the jewelry (like white pearls or diamonds) is NOT flooded.
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    flood_img = (~is_bg_candidate).astype(np.uint8) * 255 # foreground is 255, bg candidate is 0
    
    # We flood fill from all perimeter pixels
    bg_flood = np.zeros((h, w), dtype=np.uint8)
    # Use cv2.floodFill or queue BFS
    # cv2 floodFill from borders:
    # Mark background candidate pixels connected to borders
    visited = np.zeros((h, w), dtype=bool)
    from collections import deque
    q = deque()
    
    # Seed perimeter
    for x in range(w):
        if is_bg_candidate[0, x]: visited[0, x] = True; q.append((0, x))
        if is_bg_candidate[h-1, x]: visited[h-1, x] = True; q.append((h-1, x))
    for y in range(h):
        if is_bg_candidate[y, 0] and not visited[y, 0]: visited[y, 0] = True; q.append((y, 0))
        if is_bg_candidate[y, w-1] and not visited[y, w-1]: visited[y, w-1] = True; q.append((y, w-1))
        
    while q:
        cy, cx = q.popleft()
        visited[cy, cx] = True
        for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
            if 0 <= ny < h and 0 <= nx < w:
                if not visited[ny, nx] and is_bg_candidate[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
                    
    # visited is TRUE for outer background pixels
    # visited is FALSE for foreground jewelry (including interior pearls!)
    
    # 4. Generate Alpha Channel
    alpha = np.ones((h, w), dtype=np.uint8) * 255
    alpha[visited] = 0 # Outer background is 0 alpha
    
    # Soft edge feathering on boundary
    # Boundary pixels are foreground pixels adjacent to background
    fg_mask = (~visited).astype(np.uint8) * 255
    fg_img = Image.fromarray(fg_mask, mode="L")
    if feather > 0:
        # Blur the mask slightly to antialias edges
        fg_blur = fg_img.filter(ImageFilter.GaussianBlur(radius=feather))
        alpha = np.array(fg_blur, dtype=np.uint8)
        # Ensure deep interior is solid 255
        alpha[alpha > 240] = 255
        alpha[alpha < 15] = 0
        
    # Combine RGB with new Alpha
    rgba = np.dstack([rgb, alpha])
    result = Image.fromarray(rgba, mode="RGBA")
    
    # Crop to bounding box
    bbox = result.getbbox()
    if bbox:
        l = max(0, bbox[0] - pad)
        t = max(0, bbox[1] - pad)
        r = min(w, bbox[2] + pad)
        b = min(h, bbox[3] + pad)
        result = result.crop((l, t, r, b))
        
    result.save(output_path, "PNG", optimize=True)
    print(f"Saved: {output_path} | Size: {result.size} | BBox: {bbox}")
    return result

if __name__ == "__main__":
    uploads = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
    in_jhumka = os.path.join(uploads, "aranya-jhumka-tryon.png")
    out_jhumka = os.path.join(uploads, "test-aranya-jhumka.png")
    res = segment_and_isolate_jewellery(in_jhumka, out_jhumka)
