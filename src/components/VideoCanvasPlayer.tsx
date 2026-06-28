import React, { useEffect, useRef, useState } from "react";
import { TimelineNode } from "../types";
import { 
  Play, Pause, Square, Download, Volume2, VolumeX, AlertCircle, Loader2,
  Globe, Printer, MessageSquare, Music, FileText, Film, Maximize2, Minimize2,
  RotateCcw, RotateCw, Smartphone, Tv, Crop, Sliders
} from "lucide-react";
import { formatTime } from "../utils";

interface VideoCanvasPlayerProps {
  timeline: TimelineNode[];
  audioUrl: string | null;
  audioBase64: string | null;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isExporting: boolean;
  setIsExporting: (exporting: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  aspectRatio: "16:9" | "9:16" | "1:1";
  setAspectRatio: (ratio: "16:9" | "9:16" | "1:1") => void;
}

export default function VideoCanvasPlayer({
  timeline,
  audioUrl,
  audioBase64,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  isExporting,
  setIsExporting,
  audioRef,
  aspectRatio,
  setAspectRatio,
}: VideoCanvasPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const totalDuration = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [imagesCache, setImagesCache] = useState<Record<string, HTMLImageElement>>({});
  const [activeNode, setActiveNode] = useState<TimelineNode | null>(null);
  const requestRef = useRef<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dbLevels, setDbLevels] = useState({ left: 1, right: 1 });

  // Simulates Master Audio Output db meter fluctuations when playing
  useEffect(() => {
    if (!isPlaying || isMuted || volume === 0) {
      setDbLevels({ left: 1, right: 1 });
      return;
    }
    const interval = setInterval(() => {
      const scale = volume * 14;
      setDbLevels({
        left: Math.max(1, Math.floor(Math.random() * scale) + 1),
        right: Math.max(1, Math.floor(Math.random() * scale) + 1),
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, isMuted, volume]);

  const loadingUrlsRef = useRef<Set<string>>(new Set());

  // Preload images into cache
  useEffect(() => {
    if (timeline.length === 0) {
      loadingUrlsRef.current.clear();
      setImagesCache({});
      return;
    }

    timeline.forEach((node) => {
      if (!node.imageUrl || loadingUrlsRef.current.has(node.imageUrl)) return;

      loadingUrlsRef.current.add(node.imageUrl);

      const img = new Image();
      img.crossOrigin = "anonymous"; // Essential for MediaRecorder canvas capture!
      img.referrerPolicy = "no-referrer";
      img.src = node.imageUrl;
      img.onload = () => {
        setImagesCache((prev) => ({ ...prev, [node.imageUrl!]: img }));
      };
      img.onerror = () => {
        loadingUrlsRef.current.delete(node.imageUrl!);
      };
    });
  }, [timeline]);

  // Find active timeline node
  useEffect(() => {
    const active = timeline.find((node) => currentTime >= node.start && currentTime <= node.end) || null;
    setActiveNode(active);
  }, [currentTime, timeline]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Handle Stop
  const stopPlayback = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    setIsMuted(val === 0);
  };

  // Mute toggle
  const toggleMute = () => {
    if (audioRef.current) {
      const nextMute = !isMuted;
      audioRef.current.muted = nextMute;
      setIsMuted(nextMute);
    }
  };

  // Canvas drawing loop (Ken Burns & Subtitles)
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = "#0f172a"; // Deep Slate
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (activeNode) {
      const img = imagesCache[activeNode.imageUrl];
      if (img && img.complete) {
        // Calculate progress within this block for Ken Burns animation
        const nodeDur = activeNode.end - activeNode.start;
        const progress = nodeDur > 0 ? (currentTime - activeNode.start) / nodeDur : 0;
        const boundedProgress = Math.max(0, Math.min(progress, 1));

        // Pan and Zoom: scale slowly from 1.05 to 1.15, subtly shift coordinates
        const scale = 1.03 + 0.12 * boundedProgress;
        const shiftX = (boundedProgress - 0.5) * -40;
        const shiftY = (boundedProgress - 0.5) * -15;

        ctx.save();
        // Translate to center, scale, translate back
        ctx.translate(canvas.width / 2 + shiftX, canvas.height / 2 + shiftY);
        ctx.scale(scale, scale);

        // Aspect-ratio cover calculation
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let drawW = canvas.width;
        let drawH = canvas.height;

        if (imgRatio > canvasRatio) {
          drawW = canvas.height * imgRatio;
        } else {
          drawH = canvas.width / imgRatio;
        }

        // Apply filters!
        let filterStr = "";
        if (activeNode.filter && activeNode.filter !== "none") {
          if (activeNode.filter === "vintage") filterStr += "sepia(0.5) contrast(1.2) brightness(0.95) ";
          if (activeNode.filter === "warm") filterStr += "saturate(1.3) sepia(0.15) ";
          if (activeNode.filter === "cool") filterStr += "hue-rotate(-15deg) saturate(1.1) ";
          if (activeNode.filter === "mono") filterStr += "grayscale(1) contrast(1.1) ";
          if (activeNode.filter === "sepia") filterStr += "sepia(1.0) ";
          if (activeNode.filter === "invert") filterStr += "invert(1) ";
          if (activeNode.filter === "sketch") filterStr += "grayscale(1) contrast(3) ";
        }
        if (activeNode.brightness !== undefined && activeNode.brightness !== 100) {
          filterStr += `brightness(${activeNode.brightness}%) `;
        }
        if (activeNode.contrast !== undefined && activeNode.contrast !== 100) {
          filterStr += `contrast(${activeNode.contrast}%) `;
        }
        if (activeNode.saturation !== undefined && activeNode.saturation !== 100) {
          filterStr += `saturate(${activeNode.saturation}%) `;
        }
        if (activeNode.blur !== undefined && activeNode.blur > 0) {
          filterStr += `blur(${activeNode.blur}px) `;
        }

        ctx.filter = filterStr.trim() || "none";

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else {
        // Fallback loading state for image
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Syncing Visual Segment...", canvas.width / 2, canvas.height / 2);
      }

      // Reset filter for subsequent elements
      ctx.filter = "none";

      // Cinematic Vignette Overlay
      const grad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height / 3,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 1.5
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render Subtitles
      if (activeNode.text) {
        ctx.font = `bold ${aspectRatio === "16:9" ? "28px" : "26px"} Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const text = activeNode.text;
        const maxWidth = canvas.width - 160;
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? currentLine + " " + words[i] : words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            lines.push(currentLine);
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);

        const lineHeight = 38;
        const textHeight = lines.length * lineHeight;
        const paddingY = 16;
        const paddingX = 24;
        const rectW = Math.min(maxWidth + paddingX * 2, canvas.width - 100);
        const rectH = textHeight + paddingY * 2;
        const rectX = (canvas.width - rectW) / 2;
        const rectY = canvas.height - rectH - (aspectRatio === "9:16" ? 180 : (aspectRatio === "1:1" ? 120 : 110));

        // Subtitle background pill
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // Transparent dark slate
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 2;
        
        // Draw rounded rectangle
        ctx.beginPath();
        const r = 12; // corner radius
        ctx.moveTo(rectX + r, rectY);
        ctx.lineTo(rectX + rectW - r, rectY);
        ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + r);
        ctx.lineTo(rectX + rectW, rectY + rectH - r);
        ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - r, rectY + rectH);
        ctx.lineTo(rectX + r, rectY + rectH);
        ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - r);
        ctx.lineTo(rectX, rectY + r);
        ctx.quadraticCurveTo(rectX, rectY, rectX + r, rectY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw subtitle text lines
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 4;
        lines.forEach((line, index) => {
          const y = rectY + paddingY + lineHeight / 2 + index * lineHeight;
          ctx.fillText(line, canvas.width / 2, y);
        });
        // Reset shadow
        ctx.shadowBlur = 0;
      }
    } else {
      // Empty / Welcome Slate
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "center";
      ctx.font = "24px Inter, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(audioUrl ? "Press Play to Begin Storyboard" : "Generate Storyboard to Preview Video", canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = "14px Inter, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Your images and speech will render in cinematic real-time here.", canvas.width / 2, canvas.height / 2 + 15);
    }

    // Direct recording frame capture during exporting
    if (!isExporting) {
      requestRef.current = requestAnimationFrame(drawCanvas);
    }
  };

  // Render loop control
  useEffect(() => {
    requestRef.current = requestAnimationFrame(drawCanvas);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [currentTime, activeNode, imagesCache, isExporting, aspectRatio]);

  // Handle timeline seek directly via slider
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioUrl) return;
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  // Fullscreen support
  const [isFullscreen, setIsFullscreen] = useState(false);
  const handleFullscreen = () => {
    const container = document.getElementById("video-canvas-container");
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Playback rate speed state
  const [playbackRate, setPlaybackRate] = useState(1.0);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioUrl, isPlaying]);

  // Skip time forward or backward
  const skipTimeBy = (amount: number) => {
    if (!audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(totalDuration, audio.currentTime + amount));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in inputs or textareas
      if (
        document.activeElement?.tagName === "INPUT" || 
        document.activeElement?.tagName === "TEXTAREA" || 
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skipTimeBy(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skipTimeBy(5);
      } else if (e.code === "KeyF") {
        e.preventDefault();
        handleFullscreen();
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioUrl, isPlaying, totalDuration, isMuted, playbackRate]);

  // EXPORT VIDEO IMPLEMENTATION (High-performance server-side ffmpeg compilation)
  const exportVideo = async () => {
    if (timeline.length === 0) return;

    setExportError(null);
    setIsExporting(true);
    setExportProgress(10);
    setIsPlaying(false);

    // Pause audio playback
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Animate progress bar gently during background processing
    const progressInterval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev < 90) {
          return prev + Math.floor(Math.random() * 8) + 3;
        }
        return prev;
      });
    }, 350);

    try {
      // Make API POST request to compile the video offline using server-side ffmpeg
      const response = await fetch("/api/export-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeline,
          audioBase64,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to compile video on server.");
      }

      const data = await response.json();
      if (!data.videoBase64) {
        throw new Error("No video data returned from compilation server.");
      }

      setExportProgress(100);

      // Convert base64 to Blob and download as MP4
      const binaryStr = atob(data.videoBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const videoBlob = new Blob([bytes], { type: "video/mp4" });
      const videoUrl = URL.createObjectURL(videoBlob);

      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `storyboard-cinematic-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoke the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(videoUrl), 10000);

      setIsExporting(false);
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Video export failed:", err);
      setExportError(err.message || "Failed to compile video offline on the server. Please try again.");
      setIsExporting(false);
    }
  };

  // 1. Export as Standalone Interactive Web-Based Cinematic Player (.html)
  const exportStandalonePlayer = () => {
    if (!audioBase64 || timeline.length === 0) {
      alert("Please ensure audio is fully generated before exporting the interactive player.");
      return;
    }

    const timelineJson = JSON.stringify(timeline);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FableForge Cinematic Storyboard Player</title>
  <style>
    body {
      margin: 0;
      background-color: #0b1329;
      color: #f1f5f9;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
      padding: 20px;
    }
    .wrapper {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
      color: #38bdf8;
      font-family: monospace;
      text-transform: uppercase;
    }
    .badge {
      background-color: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      padding: 4px 10px;
      font-size: 0.75rem;
      border-radius: 9999px;
      font-weight: 600;
      font-family: monospace;
    }
    .player-container {
      width: 100%;
      aspect-ratio: 16/9;
      background-color: #020617;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    }
    .video-stage {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    .slide-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      transition: opacity 0.4s ease-in-out, transform 0.4s ease-out;
      transform: scale(1.04);
    }
    .slide-image.active {
      opacity: 1;
      transform: scale(1.0);
    }
    .vignette {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, transparent 35%, rgba(0,0,0,0.65) 100%);
      pointer-events: none;
      z-index: 5;
    }
    .subtitles-container {
      position: absolute;
      bottom: 90px;
      left: 5%;
      right: 5%;
      display: flex;
      justify-content: center;
      z-index: 10;
      pointer-events: none;
    }
    .subtitle-bubble {
      background-color: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 1.4rem;
      font-weight: 600;
      text-align: center;
      max-width: 85%;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
      line-height: 1.4;
      text-shadow: 0 2px 4px rgba(0,0,0,0.6);
    }
    .controls-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(2, 6, 17, 0.95) 0%, rgba(2, 6, 17, 0.75) 80%, transparent 100%);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 15;
    }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .time-label {
      font-family: monospace;
      font-size: 0.75rem;
      color: #94a3b8;
      min-width: 45px;
    }
    .progress-slider {
      flex: 1;
      height: 5px;
      background: #1e293b;
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    .progress-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
    }
    .buttons-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .control-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .control-btn:hover {
      color: #f1f5f9;
      background-color: rgba(255, 255, 255, 0.06);
    }
    .play-btn {
      background-color: #38bdf8;
      color: #020617;
      border-radius: 50%;
      padding: 8px;
      width: 36px;
      height: 36px;
    }
    .play-btn:hover {
      background-color: #7dd3fc;
      transform: scale(1.05);
    }
    .play-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .volume-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .volume-slider {
      width: 70px;
      height: 4px;
      background: #1e293b;
      border-radius: 2px;
      outline: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
    }
    footer {
      text-align: center;
      font-size: 0.75rem;
      color: #475569;
      font-family: monospace;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <h1>FableForge Standalone Story Player</h1>
      <span class="badge">Offline Web App</span>
    </header>

    <div class="player-container">
      <div class="video-stage" id="video-stage">
        <!-- Images will transition here -->
        <div class="vignette"></div>
        <div class="subtitles-container">
          <div class="subtitle-bubble" id="subtitle-bubble">Preparing Playback...</div>
        </div>
      </div>

      <div class="controls-bar">
        <div class="progress-row">
          <span class="time-label" id="time-current">0:00</span>
          <input type="range" class="progress-slider" id="progress-slider" min="0" max="100" step="0.1" value="0">
          <span class="time-label" id="time-total">0:00</span>
        </div>

        <div class="buttons-row">
          <div class="control-group">
            <button class="control-btn play-btn" id="play-btn">
              <!-- Play icon -->
              <svg viewBox="0 0 24 24" id="play-icon"><path d="M8 5v14l11-7z"/></svg>
              <!-- Pause icon (hidden initially) -->
              <svg viewBox="0 0 24 24" id="pause-icon" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="control-btn" id="stop-btn" title="Stop">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            </button>
            <div class="volume-row">
              <button class="control-btn" id="mute-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <input type="range" class="volume-slider" id="volume-slider" min="0" max="1" step="0.05" value="0.8">
            </div>
          </div>

          <div class="control-group">
            <button class="control-btn" id="fullscreen-btn" title="Fullscreen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <footer>
      Generated via FableForge Studio • 100% Client-Side High-Definition
    </footer>
  </div>

  <!-- Audio source embed -->
  <audio id="audio-player" src="data:audio/wav;base64,${audioBase64}"></audio>

  <script>
    const timeline = ${timelineJson};
    const audio = document.getElementById("audio-player");
    const playBtn = document.getElementById("play-btn");
    const playIcon = document.getElementById("play-icon");
    const pauseIcon = document.getElementById("pause-icon");
    const stopBtn = document.getElementById("stop-btn");
    const muteBtn = document.getElementById("mute-btn");
    const volumeSlider = document.getElementById("volume-slider");
    const progressSlider = document.getElementById("progress-slider");
    const timeCurrent = document.getElementById("time-current");
    const timeTotal = document.getElementById("time-total");
    const videoStage = document.getElementById("video-stage");
    const subtitleBubble = document.getElementById("subtitle-bubble");
    const fullscreenBtn = document.getElementById("fullscreen-btn");

    // Preload images
    const imageElements = [];
    timeline.forEach((node, idx) => {
      const img = document.createElement("img");
      img.className = "slide-image" + (idx === 0 ? " active" : "");
      img.src = node.imageUrl;
      videoStage.insertBefore(img, videoStage.firstChild);
      imageElements.push(img);
    });

    function formatTime(secs) {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return m + ":" + (s < 10 ? "0" : "") + s;
    }

    // Load metadata
    audio.addEventListener("loadedmetadata", () => {
      timeTotal.textContent = formatTime(audio.duration);
    });

    // Toggle Play/Pause
    playBtn.addEventListener("click", () => {
      if (audio.paused) {
        audio.play().catch(err => alert("Please interact with the page first."));
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      } else {
        audio.pause();
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      }
    });

    // Stop playback
    stopBtn.addEventListener("click", () => {
      audio.pause();
      audio.currentTime = 0;
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
      updateUI();
    });

    // Volume controls
    volumeSlider.addEventListener("input", (e) => {
      audio.volume = e.target.value;
      audio.muted = e.target.value === "0";
    });

    muteBtn.addEventListener("click", () => {
      audio.muted = !audio.muted;
      if (audio.muted) {
        volumeSlider.value = 0;
      } else {
        volumeSlider.value = audio.volume;
      }
    });

    // Progress bar seek
    progressSlider.addEventListener("input", (e) => {
      if (audio.duration) {
        audio.currentTime = (e.target.value / 100) * audio.duration;
      }
    });

    // Sync playhead state
    audio.addEventListener("timeupdate", updateUI);
    
    function updateUI() {
      const current = audio.currentTime;
      const total = audio.duration || 1;
      
      timeCurrent.textContent = formatTime(current);
      progressSlider.value = (current / total) * 100;

      // Update active slide and subtitles
      let activeNode = null;
      timeline.forEach((node, idx) => {
        if (current >= node.start && current <= node.end) {
          activeNode = node;
          imageElements.forEach((img, i) => {
            if (i === idx) {
              img.classList.add("active");
            } else {
              img.classList.remove("active");
            }
          });
        }
      });

      if (activeNode) {
        subtitleBubble.style.display = "block";
        subtitleBubble.textContent = activeNode.text;
      } else {
        subtitleBubble.style.display = "none";
      }
    }

    // Fullscreen toggle
    fullscreenBtn.addEventListener("click", () => {
      const container = document.querySelector(".player-container");
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
          alert("Error enabling fullscreen mode.");
        });
      } else {
        document.exitFullscreen();
      }
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cinematic-interactive-story-player.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Export as printable guidebook storyboard layout
  const exportPrintableStoryboard = () => {
    if (timeline.length === 0) return;

    let itemsHtml = "";
    timeline.forEach((node, idx) => {
      itemsHtml += `
      <div class="slide-card">
        <div class="slide-num">SCENE ${idx + 1} (${formatTime(node.start)} - ${formatTime(node.end)})</div>
        <div class="slide-content">
          <div class="image-box">
            <img src="${node.imageUrl}" alt="Scene visual" />
          </div>
          <div class="metadata-box">
            <div class="meta-section">
              <h3>Spoken Subtitles & Narration</h3>
              <p class="narration-text">"${node.text}"</p>
            </div>
            <div class="meta-section">
              <h3>Visual AI Prompt</h3>
              <p class="prompt-text">${node.prompt || "Default scenic visuals"}</p>
            </div>
          </div>
        </div>
      </div>
      `;
    });

    const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Storyboard Presentation Document</title>
  <style>
    body {
      background-color: #f8fafc;
      color: #0f172a;
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #1e293b;
      margin: 0;
    }
    .print-btn {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 18px;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
    }
    @media print {
      body { padding: 0; background: white; }
      .print-btn { display: none; }
    }
    .slide-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      page-break-inside: avoid;
    }
    .slide-num {
      background-color: #1e293b;
      color: white;
      padding: 10px 16px;
      font-weight: bold;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      font-family: monospace;
    }
    .slide-content {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
      padding: 20px;
    }
    @media (max-width: 600px) {
      .slide-content { grid-template-columns: 1fr; }
    }
    .image-box img {
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }
    .metadata-box {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .meta-section h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
      margin: 0 0 6px 0;
    }
    .narration-text {
      font-size: 1.05rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.4;
      margin: 0;
    }
    .prompt-text {
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.4;
      margin: 0;
      font-family: monospace;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>FableForge Storyboard Document Guide</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 0.85rem;">Generated Storyboard Guide & Custom Prompts</p>
      </div>
      <button class="print-btn" onclick="window.print()">Print or Save PDF</button>
    </header>
    ${itemsHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([printHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "storyboard-guide-document.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Helper to format SRT timing strings
  const formatSrtTime = (seconds: number): string => {
    const pad = (num: number, size: number) => num.toString().padStart(size, "0");
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
  };

  // 3. Export SRT Subtitles track
  const exportSrtSubtitles = () => {
    if (timeline.length === 0) return;

    let srtText = "";
    timeline.forEach((node, idx) => {
      srtText += `${idx + 1}\n`;
      srtText += `${formatSrtTime(node.start)} --> ${formatSrtTime(node.end)}\n`;
      srtText += `${node.text}\n\n`;
    });

    const blob = new Blob([srtText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storyboard-captions.srt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 4. Export Raw Master Speech WAV Track
  const exportRawWavAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "storyboard-voiceover.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };  return (
    <div id="video-canvas-container" className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 w-full h-full max-w-[850px] mx-auto">
      {/* Header Info with Aspect Ratio Switcher */}
      <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">Canvas Visualizer</h3>
        </div>

        {/* Aspect Ratio Switcher Tabs */}
        <div className="flex items-center bg-slate-900 p-0.5 border border-slate-800 rounded-lg space-x-0.5">
          <button
            type="button"
            onClick={() => setAspectRatio("16:9")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold font-mono rounded-md transition-all cursor-pointer ${
              aspectRatio === "16:9" 
                ? "bg-slate-800 text-sky-400 border border-slate-700/50" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Horizontal Widescreen (YouTube)"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>16:9</span>
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio("9:16")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold font-mono rounded-md transition-all cursor-pointer ${
              aspectRatio === "9:16" 
                ? "bg-slate-800 text-sky-400 border border-slate-700/50" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Vertical Short Format (TikTok, Reels)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16</span>
          </button>
          <button
            type="button"
            onClick={() => setAspectRatio("1:1")}
            className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold font-mono rounded-md transition-all cursor-pointer ${
              aspectRatio === "1:1" 
                ? "bg-slate-800 text-sky-400 border border-slate-700/50" 
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Square Format (Instagram Posts)"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>1:1</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400 font-mono">
          Resolution: <span className="text-sky-400 font-bold">
            {aspectRatio === "16:9" ? "1280x720" : (aspectRatio === "9:16" ? "720x1280" : "720x720")}
          </span>
        </div>
      </div>

      {/* Main Canvas Frame */}
      <div className="flex flex-row bg-slate-950 items-stretch overflow-hidden border-b border-slate-800">
        <div className={`relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden transition-all ${
          isFullscreen ? "h-screen" : (
            aspectRatio === "9:16" 
              ? "aspect-[9/16] max-h-[460px]" 
              : (aspectRatio === "1:1" ? "aspect-square max-h-[380px]" : "aspect-video")
          )
        }`}>
          <canvas
            ref={canvasRef}
            width={aspectRatio === "9:16" ? 720 : (aspectRatio === "1:1" ? 720 : 1280)}
            height={aspectRatio === "9:16" ? 1280 : (aspectRatio === "1:1" ? 720 : 720)}
            className="w-full h-full object-contain"
            id="visualizer-canvas"
          />

          {/* Export Overlay */}
          {isExporting && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 z-30 transition-all">
              <Loader2 className="w-12 h-12 text-sky-400 animate-spin mb-4" />
              <h4 className="text-lg font-bold text-white mb-2">Compiling HD Cinematic Video</h4>
              <p className="text-slate-400 text-sm mb-6 max-w-sm text-center leading-relaxed">
                Our cloud background engine is assembling the high-quality synchronized storyboard visuals, overlaying human speech, and burning subtitles directly into an HD MP4 file.
              </p>
              <div className="w-64 bg-slate-800 rounded-full h-3.5 p-0.5 overflow-hidden border border-slate-700">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-300 shadow-md shadow-sky-500/50"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <span className="text-sky-400 font-mono text-sm font-bold mt-2">{exportProgress}% Completed</span>
            </div>
          )}

          {/* Error overlay */}
          {exportError && (
            <div className="absolute top-4 left-4 right-4 bg-red-950/90 border border-red-800 text-red-200 p-3 rounded-lg flex items-start space-x-2 text-xs z-20">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">
                <span className="font-bold">Export Error:</span> {exportError}
              </div>
            </div>
          )}
        </div>

        {/* dB Master audio meter */}
        {!isFullscreen && (
          <div className="w-12 bg-slate-950/90 border-l border-slate-900 flex flex-col justify-between items-center py-3 px-1 shrink-0 select-none font-mono">
            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider scale-90 mb-1 text-center w-full">MTR L/R</span>
            
            <div className="flex-1 w-full flex justify-center space-x-1 py-1">
              {/* Left Channel */}
              <div className="w-2.5 h-full bg-slate-900/60 rounded flex flex-col justify-end p-0.5 space-y-[2px]">
                {Array.from({ length: 14 }).map((_, idx) => {
                  const levelVal = 14 - idx;
                  const isActive = dbLevels.left >= levelVal;
                  let colorClass = "bg-slate-800";
                  if (isActive) {
                    colorClass = levelVal > 11 ? "bg-red-500 animate-pulse" : levelVal > 8 ? "bg-amber-400" : "bg-emerald-500";
                  }
                  return <div key={`l-${idx}`} className={`w-full h-[3px] rounded-[1px] transition-all duration-75 ${colorClass}`} />;
                })}
              </div>

              {/* Right Channel */}
              <div className="w-2.5 h-full bg-slate-900/60 rounded flex flex-col justify-end p-0.5 space-y-[2px]">
                {Array.from({ length: 14 }).map((_, idx) => {
                  const levelVal = 14 - idx;
                  const isActive = dbLevels.right >= levelVal;
                  let colorClass = "bg-slate-800";
                  if (isActive) {
                    colorClass = levelVal > 11 ? "bg-red-500 animate-pulse" : levelVal > 8 ? "bg-amber-400" : "bg-emerald-500";
                  }
                  return <div key={`r-${idx}`} className={`w-full h-[3px] rounded-[1px] transition-all duration-75 ${colorClass}`} />;
                })}
              </div>
            </div>

            <span className="text-[7px] font-bold text-slate-400 font-mono mt-1 text-center scale-90 truncate w-full">
              {isPlaying && !isMuted ? `-${(15 - Math.max(dbLevels.left, dbLevels.right)).toFixed(0)}dB` : "OFF"}
            </span>
          </div>
        )}
      </div>

      {/* Timeline scrubbing & controls */}
      <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-col space-y-4">
        {/* Scrubbing track bar */}
        <div className="flex items-center space-x-4">
          <span className="text-xs font-mono text-sky-400 w-12 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || isExporting}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 focus:outline-none disabled:opacity-50"
            id="playhead-slider"
          />
          <span className="text-xs font-mono text-slate-400 w-12">{formatTime(totalDuration)}</span>
        </div>        {/* Master Control Panel */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-900/40">
          {/* Playback action controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="btn-play-pause"
              onClick={togglePlay}
              disabled={!audioUrl || isExporting}
              className={`p-3 rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-md ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10"
                  : "bg-sky-500 hover:bg-sky-600 text-slate-950 shadow-sky-500/10"
              } disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer`}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950" />}
            </button>
            <button
              id="btn-stop"
              onClick={stopPlayback}
              disabled={!audioUrl || isExporting}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 disabled:opacity-30 cursor-pointer"
              title="Stop"
            >
              <Square className="w-5 h-5 fill-slate-300" />
            </button>

            {/* Skip 10s buttons */}
            <div className="flex items-center bg-slate-900/85 border border-slate-800 rounded-xl p-1 space-x-1">
              <button
                type="button"
                onClick={() => skipTimeBy(-10)}
                disabled={!audioUrl || isExporting}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-slate-500 select-none">10s</span>
              <button
                type="button"
                onClick={() => skipTimeBy(10)}
                disabled={!audioUrl || isExporting}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center bg-slate-900/85 border border-slate-800 rounded-xl px-3 py-2 space-x-2">
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Right controls: Playback rate & Fullscreen */}
          <div className="flex items-center space-x-3 self-end md:self-auto">
            {/* Playback Rate Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-900/85 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider font-semibold">Speed</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                disabled={!audioUrl || isExporting}
                className="bg-transparent text-xs font-mono font-bold text-sky-400 focus:outline-none cursor-pointer"
              >
                <option value="0.5" className="bg-slate-950 text-slate-200">0.5x</option>
                <option value="1.0" className="bg-slate-950 text-slate-200">1.0x</option>
                <option value="1.25" className="bg-slate-950 text-slate-200">1.25x</option>
                <option value="1.5" className="bg-slate-950 text-slate-200">1.5x</option>
                <option value="2.0" className="bg-slate-950 text-slate-200">2.0x</option>
              </select>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={handleFullscreen}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all cursor-pointer"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* PRO EXPORT HUB */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono mb-3">
            Pro Storyboard Export Hub
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {/* 🎬 Video File */}
            <button
              onClick={exportVideo}
              disabled={timeline.length === 0 || isExporting}
              className="flex flex-col items-center justify-center p-3 bg-slate-900/60 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-700 border border-slate-800/80 rounded-xl transition-all gap-1.5 cursor-pointer disabled:cursor-not-allowed group text-center"
              title="Compile the visual storyboard and voice track into a high-fidelity MP4 video file instantly on the server"
            >
              <Film className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300">HD Video File</span>
              <span className="text-[8px] font-mono text-slate-500">H.264 MP4</span>
            </button>

            {/* 🌐 Interactive HTML Player */}
            <button
              onClick={exportStandalonePlayer}
              disabled={!audioBase64 || timeline.length === 0 || isExporting}
              className="flex flex-col items-center justify-center p-3 bg-slate-900/60 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-700 border border-slate-800/80 rounded-xl transition-all gap-1.5 cursor-pointer disabled:cursor-not-allowed group text-center"
              title="Download a self-contained, offline-playable interactive player with uncompressed quality"
            >
              <Globe className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300">HTML5 Player</span>
              <span className="text-[8px] font-mono text-slate-500">Instant HD</span>
            </button>

            {/* 📄 Printable Guide / PDF */}
            <button
              onClick={exportPrintableStoryboard}
              disabled={timeline.length === 0 || isExporting}
              className="flex flex-col items-center justify-center p-3 bg-slate-900/60 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-700 border border-slate-800/80 rounded-xl transition-all gap-1.5 cursor-pointer disabled:cursor-not-allowed group text-center"
              title="Open a beautiful print-ready guidebook detailing all scenes, narration, and AI prompts"
            >
              <Printer className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300">Print Guide / PDF</span>
              <span className="text-[8px] font-mono text-slate-500">Interactive</span>
            </button>

            {/* 💬 Captions SRT */}
            <button
              onClick={exportSrtSubtitles}
              disabled={timeline.length === 0 || isExporting}
              className="flex flex-col items-center justify-center p-3 bg-slate-900/60 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-700 border border-slate-800/80 rounded-xl transition-all gap-1.5 cursor-pointer disabled:cursor-not-allowed group text-center"
              title="Download a standard SRT subtitle file for Premiere, DaVinci, or CapCut editors"
            >
              <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300">Subtitles (.SRT)</span>
              <span className="text-[8px] font-mono text-slate-500">Pro Captions</span>
            </button>

            {/* 🎵 WAV Audio */}
            <button
              onClick={exportRawWavAudio}
              disabled={!audioUrl || isExporting}
              className="flex flex-col items-center justify-center p-3 bg-slate-900/60 hover:bg-slate-800 disabled:bg-slate-950/40 disabled:text-slate-700 border border-slate-800/80 rounded-xl transition-all gap-1.5 cursor-pointer disabled:cursor-not-allowed group col-span-2 sm:col-span-1 text-center"
              title="Download the pristine master voice track directly"
            >
              <Music className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-slate-300">Voice Track (.WAV)</span>
              <span className="text-[8px] font-mono text-slate-500">High Fidelity</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
