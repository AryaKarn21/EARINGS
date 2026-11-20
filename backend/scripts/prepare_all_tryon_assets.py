import os
import shutil
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

BACKEND_UPLOADS = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
FRONTEND_UPLOADS = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\frontend\public\uploads"

os.makedirs(BACKEND_UPLOADS, exist_ok=True)
os.makedirs(FRONTEND_UPLOADS, exist_ok=True)

def process_white_bg_jewellery(input_path, output_path, tol=28, feather=1.2, pad=10):
    im = Image.open(input_path).convert("RGB")
    w, h = im.size
    rgb = np.array(im, dtype=np.uint8)
    
    margin = 6
    top = rgb[:margin, :, :].reshape(-1, 3)
    bottom = rgb[-margin:, :, :].reshape(-1, 3)
    left = rgb[:, :margin, :].reshape(-1, 3)
    right = rgb[:, -margin:, :].reshape(-1, 3)
    borders = np.concatenate([top, bottom, left, right], axis=0)
    bg_color = np.median(borders, axis=0)
    
    diff = np.sqrt(np.sum((rgb.astype(np.float32) - bg_color) ** 2, axis=2))
    is_white_bg = (bg_color[0] + bg_color[1] + bg_color[2]) / 3.0 > 220
    if is_white_bg:
        is_bg = (diff < tol) | ((rgb[:,:,0] > 238) & (rgb[:,:,1] > 238) & (rgb[:,:,2] > 238))
    else:
        is_bg = (diff < tol)
        
    mask_rgb = np.zeros((h + 2, w + 2, 3), dtype=np.uint8)
    mask_rgb[1:-1, 1:-1][is_bg] = [255, 255, 255]
    mask_rgb[0, :] = [255, 255, 255]
    mask_rgb[-1, :] = [255, 255, 255]
    mask_rgb[:, 0] = [255, 255, 255]
    mask_rgb[:, -1] = [255, 255, 255]

    pil_mask = Image.fromarray(mask_rgb, mode="RGB")
    ImageDraw.floodfill(pil_mask, (0, 0), (128, 0, 0))
    filled = np.array(pil_mask)[1:-1, 1:-1, 0]
    is_connected_bg = (filled == 128)
                    
    fg_mask = (~is_connected_bg).astype(np.uint8) * 255
    fg_img = Image.fromarray(fg_mask, mode="L")
    if feather > 0:
        fg_blur = fg_img.filter(ImageFilter.GaussianBlur(radius=feather))
        alpha = np.array(fg_blur, dtype=np.uint8)
        alpha[alpha > 240] = 255
        alpha[alpha < 15] = 0
    else:
        alpha = fg_mask
        
    rgba = np.dstack([rgb, alpha])
    result = Image.fromarray(rgba, mode="RGBA")
    
    bbox = result.getbbox()
    if bbox:
        l = max(0, bbox[0] - pad)
        t = max(0, bbox[1] - pad)
        r = min(w, bbox[2] + pad)
        b = min(h, bbox[3] + pad)
        result = result.crop((l, t, r, b))
        
    result.save(output_path, "PNG", optimize=True)
    return result

def process_gradient_choker(input_path, output_path, feather=1.2, pad=10):
    im = Image.open(input_path).convert("RGB")
    w, h = im.size
    rgb = np.array(im, dtype=np.uint8)
    r, g, b = rgb[:,:,0].astype(int), rgb[:,:,1].astype(int), rgb[:,:,2].astype(int)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    brightness = (r + g + b) // 3
    
    # Foreground jewelry: gold/red/green stones
    is_jewel = (chroma >= 14) | ((brightness < 165) & (chroma >= 6))
    is_bg = ~is_jewel
    
    mask_rgb = np.zeros((h + 2, w + 2, 3), dtype=np.uint8)
    mask_rgb[1:-1, 1:-1][is_bg] = [255, 255, 255]
    mask_rgb[0, :] = [255, 255, 255]
    mask_rgb[-1, :] = [255, 255, 255]
    mask_rgb[:, 0] = [255, 255, 255]
    mask_rgb[:, -1] = [255, 255, 255]

    pil_mask = Image.fromarray(mask_rgb, mode="RGB")
    ImageDraw.floodfill(pil_mask, (0, 0), (128, 0, 0))
    filled = np.array(pil_mask)[1:-1, 1:-1, 0]
    is_connected_bg = (filled == 128)
    
    fg_mask = (~is_connected_bg).astype(np.uint8) * 255
    fg_img = Image.fromarray(fg_mask, mode="L")
    if feather > 0:
        fg_blur = fg_img.filter(ImageFilter.GaussianBlur(radius=feather))
        alpha = np.array(fg_blur, dtype=np.uint8)
        alpha[alpha > 240] = 255
        alpha[alpha < 15] = 0
    else:
        alpha = fg_mask
        
    rgba = np.dstack([rgb, alpha])
    result = Image.fromarray(rgba, mode="RGBA")
    
    bbox = result.getbbox()
    if bbox:
        l = max(0, bbox[0] - pad)
        t = max(0, bbox[1] - pad)
        r = min(w, bbox[2] + pad)
        b = min(h, bbox[3] + pad)
        result = result.crop((l, t, r, b))
        
    result.save(output_path, "PNG", optimize=True)
    return result

def process_dark_bg_necklace(input_path, output_path, feather=1.2, pad=10):
    im = Image.open(input_path).convert("RGB")
    w, h = im.size
    rgb = np.array(im, dtype=np.uint8)
    r, g, b = rgb[:,:,0].astype(int), rgb[:,:,1].astype(int), rgb[:,:,2].astype(int)
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    brightness = (r + g + b) // 3
    
    is_dark_bg = (brightness < 115) & (chroma < 22)
    
    mask_rgb = np.zeros((h + 2, w + 2, 3), dtype=np.uint8)
    mask_rgb[1:-1, 1:-1][is_dark_bg] = [255, 255, 255]
    mask_rgb[0, :] = [255, 255, 255]
    mask_rgb[-1, :] = [255, 255, 255]
    mask_rgb[:, 0] = [255, 255, 255]
    mask_rgb[:, -1] = [255, 255, 255]

    pil_mask = Image.fromarray(mask_rgb, mode="RGB")
    ImageDraw.floodfill(pil_mask, (0, 0), (128, 0, 0))
    filled = np.array(pil_mask)[1:-1, 1:-1, 0]
    is_connected_bg = (filled == 128)
    
    fg_mask = (~is_connected_bg).astype(np.uint8) * 255
    fg_img = Image.fromarray(fg_mask, mode="L")
    if feather > 0:
        fg_blur = fg_img.filter(ImageFilter.GaussianBlur(radius=feather))
        alpha = np.array(fg_blur, dtype=np.uint8)
        alpha[alpha > 240] = 255
        alpha[alpha < 15] = 0
    else:
        alpha = fg_mask
        
    rgba = np.dstack([rgb, alpha])
    result = Image.fromarray(rgba, mode="RGBA")
    
    bbox = result.getbbox()
    if bbox:
        l = max(0, bbox[0] - pad)
        t = max(0, bbox[1] - pad)
        r = min(w, bbox[2] + pad)
        b = min(h, bbox[3] + pad)
        result = result.crop((l, t, r, b))
        
    result.save(output_path, "PNG", optimize=True)
    return result

def process_all():
    print("Processing all jewellery assets into genuine transparent PNGs...")
    
    # 1. aranya-jhumka-tryon.png
    dst_jhumka = os.path.join(BACKEND_UPLOADS, "aranya-jhumka-tryon.png")
    process_white_bg_jewellery(dst_jhumka, dst_jhumka, tol=28)
    shutil.copyfile(dst_jhumka, os.path.join(FRONTEND_UPLOADS, "aranya-jhumka-tryon.png"))
    print("[OK] aranya-jhumka-tryon.png processed & synced")
    
    # 2. solstice-pearl-drop-tryon.png
    dst_solstice = os.path.join(BACKEND_UPLOADS, "solstice-pearl-drop-tryon.png")
    process_white_bg_jewellery(dst_solstice, dst_solstice, tol=28)
    shutil.copyfile(dst_solstice, os.path.join(FRONTEND_UPLOADS, "solstice-pearl-drop-tryon.png"))
    print("[OK] solstice-pearl-drop-tryon.png processed & synced")
    
    # 3. gulabi-chandbali-tryon.png
    dst_chandbali = os.path.join(BACKEND_UPLOADS, "gulabi-chandbali-tryon.png")
    process_white_bg_jewellery(dst_chandbali, dst_chandbali, tol=28)
    shutil.copyfile(dst_chandbali, os.path.join(FRONTEND_UPLOADS, "gulabi-chandbali-tryon.png"))
    print("[OK] gulabi-chandbali-tryon.png processed & synced")
    
    # 4. aranya-choker-necklace-tryon.png
    dst_choker = os.path.join(BACKEND_UPLOADS, "aranya-choker-necklace-tryon.png")
    process_gradient_choker(dst_choker, dst_choker)
    shutil.copyfile(dst_choker, os.path.join(FRONTEND_UPLOADS, "aranya-choker-necklace-tryon.png"))
    print("[OK] aranya-choker-necklace-tryon.png processed & synced")
    
    # 5. royal-pearl-necklace-tryon.png
    dst_pearl_neck = os.path.join(BACKEND_UPLOADS, "royal-pearl-necklace-tryon.png")
    process_dark_bg_necklace(dst_pearl_neck, dst_pearl_neck)
    shutil.copyfile(dst_pearl_neck, os.path.join(FRONTEND_UPLOADS, "royal-pearl-necklace-tryon.png"))
    print("[OK] royal-pearl-necklace-tryon.png processed & synced")

if __name__ == "__main__":
    process_all()
    print("All transparent try-on assets processed and synchronized successfully.")
