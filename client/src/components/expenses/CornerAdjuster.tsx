import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyManualWarp, type Point, type ScanResult } from "@/lib/documentScanner/scanPipeline";

type NormalizedPoint = { x: number; y: number };

type CornerAdjusterProps = {
  file: File;
  imageUrl: string;
  initialCorners: [Point, Point, Point, Point] | null;
  onApply: (result: ScanResult) => void;
  onCancel: () => void;
};

const HANDLE_SIZE = 44;

function toNormalized(
  corners: [Point, Point, Point, Point],
  width: number,
  height: number
): [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint] {
  return corners.map((corner) => ({
    x: corner.x / width,
    y: corner.y / height,
  })) as [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];
}

function clampPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  };
}

export function CornerAdjuster({
  file,
  imageUrl,
  initialCorners,
  onApply,
  onCancel,
}: CornerAdjusterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const defaultCorners = useMemo<[NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]>(() => {
    return [
      { x: 0.05, y: 0.05 },
      { x: 0.95, y: 0.05 },
      { x: 0.95, y: 0.95 },
      { x: 0.05, y: 0.95 },
    ];
  }, []);

  const [corners, setCorners] = useState<[NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]>(
    defaultCorners
  );

  useEffect(() => {
    if (!naturalSize || !initialCorners) return;
    setCorners(toNormalized(initialCorners, naturalSize.width, naturalSize.height));
  }, [initialCorners, naturalSize]);

  useEffect(() => {
    if (dragIndex === null) return;

    const handleMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      setCorners((prev) => {
        const next = [...prev] as [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint];
        next[dragIndex] = clampPoint({ x, y });
        return next;
      });
    };

    const handleUp = () => setDragIndex(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragIndex]);

  const handleApply = async () => {
    if (!naturalSize) return;
    const absoluteCorners = corners.map((corner) => ({
      x: corner.x * naturalSize.width,
      y: corner.y * naturalSize.height,
    })) as [Point, Point, Point, Point];

    const result = await applyManualWarp(file, absoluteCorners);
    onApply(result);
  };

  const handleImageLoad = () => {
    if (!imageRef.current) return;
    setNaturalSize({
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight,
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative" ref={containerRef}>
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Adjust corners"
          className="w-full h-auto rounded-lg border"
          onLoad={handleImageLoad}
        />
        <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
            fill="rgba(59,130,246,0.15)"
            stroke="rgba(59,130,246,0.9)"
            strokeWidth="0.005"
          />
        </svg>

        {corners.map((corner, index) => (
          <button
            key={index}
            type="button"
            className="absolute rounded-full border-2 border-white bg-primary shadow-lg touch-none"
            style={{
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              left: `calc(${corner.x * 100}% - ${HANDLE_SIZE / 2}px)`,
              top: `calc(${corner.y * 100}% - ${HANDLE_SIZE / 2}px)`,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              setDragIndex(index);
            }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1">
          Apply corners
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
