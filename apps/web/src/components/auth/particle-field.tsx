"use client";

import { useEffect, useRef } from "react";

import { cn } from "@recomenda/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  maxAlpha: number;
  hue: "neutral" | "brand";
  phase: number;
  speed: number;
  targetX?: number;
  targetY?: number;
};

function initParticles(width: number, height: number): Particle[] {
  const area = width * height;
  const count = Math.min(180, Math.max(80, Math.floor(area / 9000)));
  return Array.from({ length: count }, () => {
    const maxAlpha = Math.random() * 0.5 + 0.2;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.2 + 0.6,
      alpha: maxAlpha,
      maxAlpha,
      hue: Math.random() > 0.75 ? "brand" : "neutral",
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.2,
    };
  });
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: Particle[],
  reducedMotion: boolean,
  mouseX: number,
  mouseY: number,
) {
  if (width <= 0 || height <= 0) return;
  ctx.clearRect(0, 0, width, height);

  const mouseDistance = 120;
  const mouseForce = 0.15;
  const connectionDistance = 180;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p1 = particles[i];
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < connectionDistance) {
        const opacity = (1 - distance / connectionDistance) * 0.15;
        ctx.strokeStyle = `rgba(34, 110, 52, ${opacity})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // Atualizar e desenhar partículas
  for (const p of particles) {
    if (!reducedMotion) {
      p.x += p.vx;
      p.y += p.vy;

      p.phase += p.speed * 0.02;
      const pulse = Math.sin(p.phase) * 0.3 + 0.7;
      p.alpha = p.maxAlpha * pulse;

      const dx = mouseX - p.x;
      const dy = mouseY - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < mouseDistance) {
        const force = (1 - distance / mouseDistance) * mouseForce;
        p.vx += (dx / distance) * force;
        p.vy += (dy / distance) * force;
        p.alpha = Math.min(p.maxAlpha * 1.3, 1);
      }

      p.vx *= 0.995;
      p.vy *= 0.995;

      if (p.x < -4) p.x = width + 4;
      if (p.x > width + 4) p.x = -4;
      if (p.y < -4) p.y = height + 4;
      if (p.y > height + 4) p.y = -4;
    }
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);

    if (p.hue === "brand") {
      gradient.addColorStop(0, `rgba(34, 110, 52, ${p.alpha * 0.8})`);
      gradient.addColorStop(0.7, `rgba(34, 110, 52, ${p.alpha * 0.3})`);
      gradient.addColorStop(1, `rgba(34, 110, 52, 0)`);

      // Glow effect
      ctx.shadowColor = `rgba(34, 110, 52, ${p.alpha * 0.5})`;
      ctx.shadowBlur = p.r * 1.5;
    } else {
      gradient.addColorStop(0, `rgba(100, 116, 104, ${p.alpha * 0.7})`);
      gradient.addColorStop(0.7, `rgba(100, 116, 104, ${p.alpha * 0.2})`);
      gradient.addColorStop(1, `rgba(100, 116, 104, 0)`);

      ctx.shadowColor = `rgba(100, 116, 104, ${p.alpha * 0.3})`;
      ctx.shadowBlur = p.r;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

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
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const loop = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      drawFrame(
        ctx,
        w,
        h,
        particles,
        reducedMotion,
        mouseRef.current.x,
        mouseRef.current.y,
      );
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

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    if (!reducedMotion) {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
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
