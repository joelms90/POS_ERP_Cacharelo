/**
 * Client-Side Smart Background Removal and Image Processing Utilities
 * Provides flood-fill edge segmentation, alpha feathering, circular cropping,
 * and vignette soft-edges without needing external heavy AI models.
 */

export interface SegmentationOptions {
  tolerance?: number; // 5 to 80 (default ~30)
  feather?: number;   // 0 to 10 (default ~2)
  smoothEdges?: boolean;
}

/**
 * Loads an image URL or base64 string into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Smart boundary flood-fill background removal.
 * Starts from all 4 exterior borders to detect and clear the studio background.
 * Because it floods from exterior edges, internal white elements (e.g., white mozzarella,
 * white cream, white plates) remain intact.
 */
export async function removeBackgroundClient(
  imageSrc: string,
  options: SegmentationOptions = {}
): Promise<string> {
  const { tolerance = 32, feather = 2 } = options;
  const img = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  // Optimize maximum dimension for speed and crispness (max 1400px)
  const maxDim = 1400;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Sample corner colors to determine target background color
  const samplePoints = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
    [Math.floor(w / 2), h - 3],
    [2, Math.floor(h / 2)],
    [w - 3, Math.floor(h / 2)]
  ];

  let sumR = 0, sumG = 0, sumB = 0, sampleCount = 0;
  for (const [sx, sy] of samplePoints) {
    const idx = (sy * w + sx) * 4;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    sampleCount++;
  }
  const bgR = sumR / sampleCount;
  const bgG = sumG / sampleCount;
  const bgB = sumB / sampleCount;

  // Helper: color distance in RGB space
  const colorDist = (r: number, g: number, b: number) => {
    return Math.sqrt(
      Math.pow(r - bgR, 2) * 0.299 +
      Math.pow(g - bgG, 2) * 0.587 +
      Math.pow(b - bgB, 2) * 0.114
    );
  };

  // Visited array for flood-fill (1 = background, 0 = foreground)
  const isBg = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed boundary pixels
  const pushPixel = (x: number, y: number) => {
    const pIdx = y * w + x;
    if (isBg[pIdx] === 0) {
      const dIdx = pIdx * 4;
      const dist = colorDist(data[dIdx], data[dIdx + 1], data[dIdx + 2]);
      // If close to background color or very bright white
      const isWhite = data[dIdx] > 230 && data[dIdx + 1] > 230 && data[dIdx + 2] > 230;
      if (dist <= tolerance || (isWhite && dist <= tolerance * 1.5)) {
        isBg[pIdx] = 1;
        queue.push(pIdx);
      }
    }
  };

  // Top and Bottom borders
  for (let x = 0; x < w; x++) {
    pushPixel(x, 0);
    pushPixel(x, h - 1);
  }
  // Left and Right borders
  for (let y = 0; y < h; y++) {
    pushPixel(0, y);
    pushPixel(w - 1, y);
  }

  // Flood fill algorithm
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    const px = p % w;
    const py = Math.floor(p / w);

    const neighbors = [
      [px + 1, py],
      [px - 1, py],
      [px, py + 1],
      [px, py - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const npIdx = ny * w + nx;
        if (isBg[npIdx] === 0) {
          const ndIdx = npIdx * 4;
          const dist = colorDist(data[ndIdx], data[ndIdx + 1], data[ndIdx + 2]);
          const isWhite = data[ndIdx] > 220 && data[ndIdx + 1] > 220 && data[ndIdx + 2] > 220;
          if (dist <= tolerance || (isWhite && dist <= tolerance * 1.35)) {
            isBg[npIdx] = 1;
            queue.push(npIdx);
          }
        }
      }
    }
  }

  // Apply alpha transparency and optional edge smoothing/feathering
  for (let i = 0; i < w * h; i++) {
    const dIdx = i * 4;
    if (isBg[i] === 1) {
      data[dIdx + 3] = 0; // Transparent
    } else if (feather > 0) {
      // Check distance to nearest background pixel for feathering
      const px = i % w;
      const py = Math.floor(i / w);
      let nearBg = false;
      for (let dy = -feather; dy <= feather && !nearBg; dy++) {
        for (let dx = -feather; dx <= feather && !nearBg; dx++) {
          const fx = px + dx;
          const fy = py + dy;
          if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
            if (isBg[fy * w + fx] === 1) {
              nearBg = true;
            }
          }
        }
      }
      if (nearBg) {
        // Soft edge fade
        data[dIdx + 3] = Math.round(data[dIdx + 3] * 0.7);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/webp', 0.95);
}

/**
 * Applies soft feathered radial vignette around the image so it fades smoothly
 * into whatever background it is placed on.
 */
export async function applySoftEdgeVignette(imageSrc: string): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas 2D context');

  ctx.drawImage(img, 0, 0);

  // Destination-in mask
  ctx.globalCompositeOperation = 'destination-in';
  const rx = canvas.width / 2;
  const ry = canvas.height / 2;
  const gradient = ctx.createRadialGradient(rx, ry, Math.min(rx, ry) * 0.55, rx, ry, Math.min(rx, ry) * 0.95);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.8, 'rgba(0,0,0,0.9)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/webp', 0.95);
}

/**
 * File to Base64 reader helper
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
