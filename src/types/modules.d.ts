declare module 'upng-js' {
  export interface UPNGFrame {
    rect: { x: number; y: number; width: number; height: number };
    delay: number;
    dispose: number;
    blend: number;
  }

  export interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UPNGFrame[];
    data: ArrayBuffer;
  }

  export function decode(buffer: ArrayBuffer): UPNGImage;
  export function toRGBA8(img: UPNGImage): ArrayBuffer[];
  const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default UPNG;
}

declare module 'gifenc' {
  export function GIFEncoder(options?: any): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        repeat?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
    }
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}
