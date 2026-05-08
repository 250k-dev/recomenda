"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  hue: "neutral" | "brand";
};

function initParticles(width: number, height: number): Particle[] {
  const area = width * height;
  const count = Math.min(100, Math.max(40, Math.floor(area / 14000)));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.45,
    vy: (Math.random() - 0.5) * 0.45,
    r: Math.random() * 1.6 + 0.35,
    alpha: Math.random() * 0.35 + 0.12,
    hue: Math.random() > 0.72 ? "brand" : "neutral",
  }));
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  reducedMotion: boolean,
) {
  if (width <= 0 || height <= 0) return;
  ctx.clearRect(0, 0, width, height);

  for (const p of particles) {
    if (!reducedMotion) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -4) p.x = width + 4;
      if (p.x > width + 4) p.x = -4;
      if (p.y < -4) p.y = height + 4;
      if (p.y > height + 4) p.y = -4;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    if (p.hue === "brand") {
      ctx.fillStyle = `rgba(34, 110, 52, ${p.alpha})`;
    } else {
      ctx.fillStyle = `rgba(100, 116, 104, ${p.alpha * 0.85})`;
    }
    ctx.fill();
  }
}

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: Particle[] = [];
    let raf = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = Math.max(parent?.clientHeight ?? window.innerHeight, window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = initParticles(w, h);
      drawFrame(ctx, w, h, particles, reducedMotion);
    };

    const loop = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      drawFrame(ctx, w, h, particles, reducedMotion);
      if (!reducedMotion) {
        raf = requestAnimationFrame(loop);
      }
    };

    const scheduleResize = () => {
      resize();
      if (canvas.clientWidth === 0) {
        requestAnimationFrame(resize);
      }
    };
    scheduleResize();
    const ro = new ResizeObserver(scheduleResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    if (!reducedMotion) {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
