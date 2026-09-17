/** Crop a rectangle out of a larger ImageData buffer (row-major, stride = src.width). */
export function cropImageData(src: ImageData, x: number, y: number, w: number, h: number): ImageData {
  const out = new ImageData(w, h);
  for (let row = 0; row < h; row++) {
    const srcOff = ((y + row) * src.width + x) * 4;
    const dstOff = row * w * 4;
    out.data.set(src.data.subarray(srcOff, srcOff + w * 4), dstOff);
  }
  return out;
}

export function imageDataToDataUrl(img: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")!.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function dataUrlToImageData(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => reject(new Error("failed to decode template image"));
    img.src = url;
  });
}
