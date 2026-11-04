/** Prepare phone photos for a small multipart Server Action request. */
export async function checkinPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a JPEG, PNG or WebP photo. On iPhone, use the camera picker or export HEIC as JPEG.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new Error("That image is too large. Choose one smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      1600 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not prepare this photo.")),
        "image/jpeg",
        0.72,
      ),
    );
    if (jpeg.size > 750 * 1024)
      throw new Error(
        "This photo is still too large after resizing. Choose a smaller image.",
      );
    return new File([jpeg], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("large")
        ? error.message
        : "Could not read that photo. Try a JPEG from your camera.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
