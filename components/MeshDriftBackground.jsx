"use client";

import { useEffect, useRef } from "react";
import { VERTEX_SHADER, FRAGMENT_SHADER } from "@/lib/meshDriftShaders";

// Dark palette (RGB 0–1). 4 colors repeated to fill the 8 uniform slots.
const COLORS = new Float32Array([
  0.020, 0.027, 0.059, // #05070F  near-black navy
  0.086, 0.110, 0.333, // #161C55  deep indigo
  0.298, 0.227, 0.620, // #4C3A9E  muted violet
  0.427, 0.333, 0.722, // #6D55B8  soft accent
  0.020, 0.027, 0.059,
  0.086, 0.110, 0.333,
  0.298, 0.227, 0.620,
  0.427, 0.333, 0.722,
]);

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Fixed, full-screen animated background.
 * Mount ONCE in the root layout. Everything else renders above it.
 *
 * @param {number} dim  0–1, extra black overlay for readability (default 0.35)
 */
export default function MeshDriftBackground({ dim = 0.35 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // falls back to the solid CSS color below

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader program linking failed:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const locations = {
      colors: gl.getUniformLocation(program, "u_colors[0]"),
      scene: gl.getUniformLocation(program, "u_scene"),
      shape: gl.getUniformLocation(program, "u_shape"),
      surface: gl.getUniformLocation(program, "u_surface"),
      finish: gl.getUniformLocation(program, "u_finish"),
      transform: gl.getUniformLocation(program, "u_transform"),
      space: gl.getUniformLocation(program, "u_space"),
      cursor: gl.getUniformLocation(program, "u_cursor"),
    };

    gl.uniform3fv(locations.colors, COLORS);
    gl.uniform4f(locations.shape, 1.9, 0.1, 0.47, 0.04);
    // contrast, brightness (pulled down), saturation
    gl.uniform4f(locations.surface, 1.54, 0.8, -0.03, 0.9);
    // hue, vignette (stronger), blur, grain
    gl.uniform4f(locations.finish, 0.0, 0.45, 0.002, 0.08);
    gl.uniform4f(locations.transform, 4012.0, 5.65, 0.12, 0.0);
    gl.uniform4f(locations.space, 0.11, -0.19, 0.0, 0.0);
    gl.uniform4f(locations.cursor, 0.0, 2.0, 0.65, 0.46);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animationFrame = null;
    let elapsed = 0;
    let previousTime = null;

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
      const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (timestamp) => {
      if (document.hidden) {
        animationFrame = null;
        previousTime = null;
        return;
      }

      if (previousTime !== null) {
        elapsed += (timestamp - previousTime) / 1000;
      }
      previousTime = timestamp;

      resize();

      gl.uniform4f(
        locations.scene,
        canvas.width,
        canvas.height,
        elapsed * -0.73,
        4.0
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Reduced motion: render a single still frame
      animationFrame = reduceMotion ? null : window.requestAnimationFrame(draw);
    };

    const start = () => {
      if (animationFrame === null && !document.hidden) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const handleResize = () => {
      resize();
      if (reduceMotion) start(); // redraw the still frame at the new size
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        previousTime = null;
      } else {
        start();
      }
    };

    resize();
    start();

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundColor: "#05070F" }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Dark overlay so content stays readable everywhere */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: dim }}
      />
    </div>
  );
}