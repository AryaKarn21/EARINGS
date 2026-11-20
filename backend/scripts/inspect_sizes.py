from PIL import Image
import os

uploads_dir = r"c:\Users\aryak\Desktop\Aurielle\Aurelie-postgres\backend\uploads"
im1 = Image.open(os.path.join(uploads_dir, "mahalakshmi-temple-gold-jhumkas.jpg"))
im2 = Image.open(os.path.join(uploads_dir, "aranya-lakshmi-choker-jhumka-set.jpg"))
im3 = Image.open(os.path.join(uploads_dir, "royal-pearl-cascade-necklace-set.jpg"))
im4 = Image.open(os.path.join(uploads_dir, "gulabi-kundan-pearl-chandbali.jpg"))

print("mahalakshmi-temple-gold-jhumkas:", im1.size)
print("aranya-lakshmi-choker-jhumka-set:", im2.size)
print("royal-pearl-cascade-necklace-set:", im3.size)
print("gulabi-kundan-pearl-chandbali:", im4.size)
