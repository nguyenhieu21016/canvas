from PIL import Image, ImageDraw

def round_corners(image_path, output_path, radius_fraction=0.15):
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    radius = int(min(w, h) * radius_fraction)

    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)

    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    result.paste(img, mask=mask)
    result.save(output_path, "PNG")
    print(f"Saved: {output_path} ({w}x{h}, radius={radius}px)")

round_corners("logo.png", "public/logo.png", radius_fraction=0.18)
