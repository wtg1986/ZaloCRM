"use client";

import * as React from "react";
import useSWR from "swr";
import { getStickerMeta, type StickerMeta } from "@/lib/chat-ops";

// Render sticker: nếu là animated (spriteUrl + nhiều frame) → CSS sprite chạy,
// ngược lại ảnh tĩnh. `meta` có thể truyền sẵn (từ list) để khỏi fetch lại.
export function AnimatedSticker({
  catId,
  id,
  size = 112,
  meta: metaProp,
  fallbackUrl,
}: {
  catId: number;
  id: number;
  size?: number;
  meta?: StickerMeta | null;
  fallbackUrl?: string;
}) {
  const { data } = useSWR(
    metaProp ? null : ["sticker-meta", catId, id],
    () => getStickerMeta(catId, id),
  );
  const meta = metaProp ?? data;

  if (meta?.spriteUrl && meta.totalFrames > 1) {
    const frame = meta.size || 130;
    const spriteW = frame * meta.totalFrames;
    return (
      <div
        role="img"
        aria-label="sticker"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${meta.spriteUrl})`,
          backgroundSize: `${(spriteW / frame) * size}px ${size}px`,
          ["--sprite-w" as string]: `${(spriteW / frame) * size}px`,
          ["--frames" as string]: meta.totalFrames,
          animation: `sticker-play ${meta.duration * meta.totalFrames}ms steps(${meta.totalFrames}) infinite`,
        }}
      />
    );
  }

  const src = meta?.staticUrl || fallbackUrl;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="sticker"
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}
