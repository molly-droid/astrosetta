import React, { useRef, useEffect } from 'react';

/**
 * Shared page header shell with animated starfield, dark background,
 * and a gradient fade at the bottom edge.
 * Wrap your header content inside it; keep padding/spacing on the inner div.
 */
export default function PageHeader({ children, className = '' }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');

    const setSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    setSize();

    const stars = Array.from({ length: 50 }, () => {
      const depth = Math.random();
      return {
        xFrac: Math.random(),
        yFrac: Math.random(),
        radius: 0.3 + depth * 1.1 + Math.random() * 0.3,
        baseOpacity: 0.15 + depth * 0.35,
        depth,
        twinkleSpeed: 0.006 + depth * 0.022,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleAmp: 0.1 + depth * 0.25,
      };
    });

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      targetMouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2, // -1..1
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let frameId;
    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Smooth mouse lerp
      mouseRef.current = {
        x: mouseRef.current.x + (targetMouseRef.current.x - mouseRef.current.x) * 0.04,
        y: mouseRef.current.y + (targetMouseRef.current.y - mouseRef.current.y) * 0.04,
      };
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      stars.forEach(star => {
        // Parallax offset
        const parallax = star.depth * 25;
        const px = star.xFrac * w + mx * parallax;
        const py = star.yFrac * h + my * parallax;

        star.twinklePhase += star.twinkleSpeed;
        const opacity = Math.max(0, Math.min(1, star.baseOpacity + Math.sin(star.twinklePhase) * star.twinkleAmp));

        // Soft halo for bright flashes
        if (star.radius > 0.9 && opacity > star.baseOpacity + 0.12) {
          ctx.beginPath();
          ctx.arc(px, py, star.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212, 175, 133, ${opacity * 0.12})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 133, ${opacity})`;
        ctx.fill();
      });
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(setSize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden border-b border-white/[0.08] ${className}`}
      style={{ background: 'rgba(7, 16, 30, 0.4)' }}
    >
      {/* Starfield canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* Content — truly centered; the fixed notification bell (top-right) may
          briefly overlap on tablet/desktop, prioritizing symmetric centering. */}
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
      {/* Soft bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
        style={{ zIndex: 2, background: 'linear-gradient(to bottom, transparent, rgba(7, 16, 30, 0.75))' }}
      />
    </div>
  );
}