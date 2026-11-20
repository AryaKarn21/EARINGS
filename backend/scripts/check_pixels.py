from PIL import Image
import os
import glob

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\frontend\public\uploads"
pngs = glob.glob(os.path.join(uploads_dir, "*.png"))

print(f"Checking {len(pngs)} PNG files in {uploads_dir}:")
for p in pngs:
    fname = os.path.basename(p)
    im = Image.open(p)
    print(f"\nFile: {fname}")
    print(f"  Format: {im.format}, Mode: {im.mode}, Size: {im.size}")
    if im.mode == "RGBA":
        extrema = im.getextrema()
        print(f"  Alpha min/max: {extrema[3]}")
        # check corners
        c_tl = im.getpixel((0, 0))
        c_tr = im.getpixel((im.width - 1, 0))
        c_bl = im.getpixel((0, im.height - 1))
        c_br = im.getpixel((im.width - 1, im.height - 1))
        print(f"  Corner (0,0): {c_tl}")
        print(f"  Corner (w-1,0): {c_tr}")
        print(f"  Corner (0,h-1): {c_bl}")
        print(f"  Corner (w-1,h-1): {c_br}")
        
        # Count transparent vs opaque pixels
        alphas = im.split()[3]
        zero_alpha = sum(1 for a in alphas.getdata() if a == 0)
        full_alpha = sum(1 for a in alphas.getdata() if a == 255)
        total = im.width * im.height
        print(f"  Transparent pixels (alpha=0): {zero_alpha}/{total} ({zero_alpha*100/total:.1f}%)")
        print(f"  Opaque pixels (alpha=255): {full_alpha}/{total} ({full_alpha*100/total:.1f}%)")
    else:
        print("  WARNING: NO ALPHA CHANNEL!")
