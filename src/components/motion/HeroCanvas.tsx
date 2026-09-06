"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The one piece of 3-D on the site — note 10 §37, §47.
 *
 * A slow-drifting particle field with a wireframe form suspended in it, sitting
 * behind the hero copy. It is abstract on purpose: a literal 3-D object would
 * date immediately and compete with the catalogue's own artwork, whereas
 * depth and slow motion read as production value without saying anything.
 *
 * EVERY COST HERE IS DELIBERATE, because three.js is ~150KB gzipped and the
 * brief asks for a very fast site:
 *
 *   - `import("three")` is INSIDE the effect, so the library is a separate
 *     chunk fetched only by this component, only on the client, only on the
 *     one page that uses it. It never enters the shared bundle.
 *   - Nothing renders until the canvas is actually on screen, and the loop
 *     stops the moment it leaves. A hero scrolled past costs nothing.
 *   - Device pixel ratio is capped at 2. A 3x phone would otherwise render
 *     nine times the pixels for no visible gain.
 *   - `prefers-reduced-motion` skips the import entirely — not just the
 *     animation. Someone who asked for less motion should not pay 150KB to
 *     download an animation they will never be shown.
 *   - Everything is disposed on unmount; WebGL contexts are a limited resource
 *     and leaking them eventually kills the tab.
 *
 * It is decoration, so it is `aria-hidden` and the hero reads correctly with
 * no canvas at all.
 */
export function HeroCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        setFailed(true);
        return;
      }
      if (disposed) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        // No WebGL — an old machine or a locked-down browser. The hero is
        // designed to look complete without this, so stay quiet.
        setFailed(true);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.z = 14;

      // Read the palette from the CSS tokens rather than hard-coding hexes, so
      // this follows the theme like every other component (note 10 §38).
      const css = getComputedStyle(document.documentElement);
      const accent = new THREE.Color(css.getPropertyValue("--accent").trim() || "#2dd4bf");
      const primary = new THREE.Color(css.getPropertyValue("--primary").trim() || "#ff4d6d");

      // Wireframe form.
      const form = new THREE.Mesh(
        new THREE.IcosahedronGeometry(5.2, 1),
        new THREE.MeshBasicMaterial({
          color: accent,
          wireframe: true,
          transparent: true,
          opacity: 0.22,
        }),
      );
      scene.add(form);

      // Particle field. 900 points is enough to read as depth and cheap enough
      // to stay at 60fps on integrated graphics.
      const COUNT = 900;
      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 34;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({
          color: primary,
          size: 0.075,
          transparent: true,
          opacity: 0.55,
        }),
      );
      scene.add(dust);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = canvas;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      let raf = 0;
      let running = false;
      const start = performance.now();

      const tick = () => {
        if (!running) return;
        const t = (performance.now() - start) / 1000;
        form.rotation.y = t * 0.06;
        form.rotation.x = Math.sin(t * 0.13) * 0.16;
        dust.rotation.y = t * 0.014;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };

      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          tick();
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      });
      io.observe(canvas);

      cleanup = () => {
        running = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        form.geometry.dispose();
        (form.material as import("three").Material).dispose();
        dustGeo.dispose();
        (dust.material as import("three").Material).dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  if (failed) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
    />
  );
}
