import React, { useRef, useState, useEffect } from "react";
import { TimelineNode } from "../types";
import { 
  Play, 
  Sparkles, 
  Trash2, 
  Plus, 
  Image as ImageIcon, 
  Loader2, 
  Scissors, 
  Music, 
  Lock, 
  Unlock, 
  ZoomIn, 
  ZoomOut, 
  Eye, 
  EyeOff, 
  Magnet, 
  Video, 
  MessageSquare,
  Activity,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Settings,
  Type
} from "lucide-react";
import { formatTime } from "../utils";

interface TimelineTrackProps {
  timeline: TimelineNode[];
  currentTime: number;
  onSelectNode: (node: TimelineNode) => void;
  onUpdateNode: (nodeId: string, updated: Partial<TimelineNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddNode: () => void;
  onGenerateAIImage: (nodeId: string) => void;
  selectedNode: TimelineNode | null;
  onSeekTo: (seconds: number) => void;
  onUpdateNodeDuration: (nodeId: string, newDuration: number) => void;
  onUpdateNodeBoundary: (nodeId: string, newStart: number) => void;
  hiddenTracks?: number[];
  onToggleTrackVisibility?: (trackNum: number) => void;
  onSplitNode?: (nodeId: string, splitTime: number) => void;
}

export default function TimelineTrack({
  timeline,
  currentTime,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onAddNode,
  onGenerateAIImage,
  selectedNode,
  onSeekTo,
  onUpdateNodeDuration,
  onUpdateNodeBoundary,
  hiddenTracks = [],
  onToggleTrackVisibility,
  onSplitNode,
}: TimelineTrackProps) {
  // Advanced state
  const [scalePx, setScalePx] = useState(32); // Zoom level: pixels per second (8 to 128)
  const [isSnapping, setIsSnapping] = useState(true); // Magnetic snapping
  const [lockedTracks, setLockedTracks] = useState<number[]>([]); // Track numbers locked as a whole
  const [soloedTracks, setSoloedTracks] = useState<number[]>([]);
  const [mutedTracks, setMutedTracks] = useState<number[]>([]);

  const toggleTrackSolo = (trackNum: number) => {
    setSoloedTracks((prev) =>
      prev.includes(trackNum) ? prev.filter((t) => t !== trackNum) : [...prev, trackNum]
    );
  };

  const toggleTrackMute = (trackNum: number) => {
    setMutedTracks((prev) =>
      prev.includes(trackNum) ? prev.filter((t) => t !== trackNum) : [...prev, trackNum]
    );
  };

  // Hover tracking and scrubbing
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Correctly compute total duration till the last clip across all layers
  const totalDuration = timeline.reduce((max, node) => Math.max(max, node.end), 0);
  const trackWidth = Math.max(900, (totalDuration + 15) * scalePx); // extended timeline buffer
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const trackHeadsRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (trackHeadsRef.current) {
      trackHeadsRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleHeadsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
    }
  };

  // Mouse event tracking for hover indicator and drag scrubbing
  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    setHoverX(clickX + scrollLeft);
  };

  const handleContainerMouseLeave = () => {
    setHoverX(null);
  };

  const startScrubbing = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only scrub with left click
    if (e.button !== 0) return;
    if (!scrollContainerRef.current) return;
    setIsScrubbing(true);
    
    const handleScrub = (clientX: number) => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const seconds = (clickX + scrollLeft) / scalePx;
      onSeekTo(Math.max(0, Math.min(totalDuration + 10, seconds)));
    };

    handleScrub(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleScrub(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Auto-scroll timeline to keep playhead in view when playing
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const playheadX = currentTime * scalePx;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;

    // If playhead is outside the visible 80% range of the viewport, scroll smoothly
    if (playheadX > scrollLeft + clientWidth * 0.85 || playheadX < scrollLeft) {
      container.scrollTo({
        left: Math.max(0, playheadX - clientWidth * 0.3),
        behavior: "smooth"
      });
    }
  }, [currentTime, scalePx]);

  // Lock toggle helper for track columns
  const toggleTrackLock = (trackNum: number) => {
    setLockedTracks((prev) =>
      prev.includes(trackNum)
        ? prev.filter((t) => t !== trackNum)
        : [...prev, trackNum]
    );
  };

  // Helper to check if a specific node is locked (either individually or by its parent track)
  const isNodeLocked = (node: TimelineNode) => {
    const trackNum = node.track || 1;
    return node.isLocked || lockedTracks.includes(trackNum);
  };

  // Drag-resize handler for stretching and compressing clips
  const startResize = (node: TimelineNode, edge: "left" | "right") => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isNodeLocked(node)) return;

    const startX = e.clientX;
    const initialStart = node.start;
    const initialEnd = node.end;
    const initialDuration = initialEnd - initialStart;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSeconds = deltaX / scalePx;

      if (edge === "right") {
        const newDuration = Math.max(0.2, initialDuration + deltaSeconds);
        onUpdateNodeDuration(node.id, newDuration);
      } else {
        const newStart = Math.max(0, initialStart + deltaSeconds);
        onUpdateNodeBoundary(node.id, newStart);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Drag handler to move clips freely in time (horizontal) and between layers (vertical)
  const startDragClip = (node: TimelineNode) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isNodeLocked(node)) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialStart = node.start;
    const initialEnd = node.end;
    const initialDuration = initialEnd - initialStart;
    const initialTrack = node.track || 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const deltaSeconds = deltaX / scalePx;

      let newStart = initialStart + deltaSeconds;
      if (newStart < 0) newStart = 0;

      // Intelligent magnetic snap logic
      if (isSnapping) {
        const snapThreshold = 6 / scalePx; // 6px magnetic range
        
        // Snap to playhead
        if (Math.abs(newStart - currentTime) < snapThreshold) {
          newStart = currentTime;
        } else if (Math.abs((newStart + initialDuration) - currentTime) < snapThreshold) {
          newStart = currentTime - initialDuration;
        }

        // Snap to other segments' start/end
        for (const other of timeline) {
          if (other.id === node.id) continue;
          
          // Snap start of current node to end of another node
          if (Math.abs(newStart - other.end) < snapThreshold) {
            newStart = other.end;
            break;
          }
          // Snap end of current node to start of another node
          if (Math.abs((newStart + initialDuration) - other.start) < snapThreshold) {
            newStart = other.start - initialDuration;
            break;
          }
          // Snap start of current node to start of another node
          if (Math.abs(newStart - other.start) < snapThreshold) {
            newStart = other.start;
            break;
          }
        }
      }

      const newEnd = newStart + initialDuration;

      // Vertical lane switching: standard track height is ~64px
      let newTrack = initialTrack;
      if (deltaY < -24) {
        newTrack = 2; // move to Top Layer V2
      } else if (deltaY > 24) {
        newTrack = 1; // move to Main Layer V1
      }

      // Check if target track is locked
      if (lockedTracks.includes(newTrack)) {
        newTrack = initialTrack; // rollback vertical move if locked
      }

      onUpdateNode(node.id, {
        start: Number(newStart.toFixed(3)),
        end: Number(newEnd.toFixed(3)),
        track: newTrack,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle click on the time ruler to seek directly
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seconds = clickX / scalePx;
    onSeekTo(Math.max(0, Math.min(totalDuration + 5, seconds)));
  };

  // Trigger Split Tool at Playhead Time
  const handleTriggerSplit = () => {
    if (!selectedNode || !onSplitNode) return;
    // Check if current playhead lies within the selected node
    if (currentTime > selectedNode.start && currentTime < selectedNode.end) {
      onSplitNode(selectedNode.id, currentTime);
    }
  };

  // Generate tick marks for the ruler dynamically
  const renderRulerTicks = () => {
    const ticks = [];
    const step = scalePx < 16 ? 10 : scalePx < 32 ? 5 : scalePx < 64 ? 2 : 1; // Adaptive ticks
    const maxTime = Math.ceil(totalDuration) + 15;
    
    for (let s = 0; s <= maxTime; s += step) {
      ticks.push(
        <div 
          key={s} 
          style={{ left: `${s * scalePx}px` }} 
          className="absolute top-0 bottom-0 flex flex-col justify-between items-start pointer-events-none select-none"
        >
          <span className="text-[9px] font-mono font-bold text-slate-500 pl-1 pt-0.5">
            {formatTime(s)}
          </span>
          <div className="w-[1px] h-2 bg-slate-700"></div>
        </div>
      );
    }
    return ticks;
  };

  // Audio Waveform mock data generation
  const audioBars = Array.from({ length: 150 }, (_, i) => {
    // Stable pseudo-random heights
    const h = 6 + Math.abs(Math.sin(i * 0.15) * 14) + Math.abs(Math.cos(i * 0.37) * 10);
    return Math.max(3, Math.min(26, h));
  });

  return (
    <div id="timeline-track-root" className="bg-slate-900/95 border border-slate-800 rounded-xl p-1 px-2 pb-1 shadow-2xl flex flex-col h-full select-none">
      
      {/* Studio Timeline Control Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-1 pb-1 border-b border-slate-800/60">
        
        {/* Track info & snapping */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800">
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-slate-300 font-sans tracking-wide">Multi-track Studio NLE</span>
          </div>

          {/* High-precision professional timecode display */}
          <div className="flex items-center space-x-2 px-2.5 py-1 bg-slate-950 rounded-md border border-slate-800 font-mono text-[10px] shadow-sm select-none">
            <span className="text-rose-400 font-black tracking-wider" title="Current Playhead Time">{formatTime(currentTime)}</span>
            <span className="text-slate-600 font-light">/</span>
            <span className="text-slate-300 font-bold" title="Timeline End (Till Last Clip)">{formatTime(totalDuration)}</span>
            <span className="text-[8px] bg-slate-800 text-slate-400 border border-slate-700/50 px-1 rounded uppercase font-sans font-bold scale-90">Total</span>
          </div>

          {/* Magnetic snapping toggle */}
          <button
            onClick={() => setIsSnapping(!isSnapping)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono transition-all border cursor-pointer ${
              isSnapping 
                ? "bg-sky-500/10 text-sky-400 border-sky-500/30" 
                : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
            }`}
            title="Toggle Magnet Snapping to Playhead & Clip Boundaries"
          >
            <Magnet className="w-3 h-3" />
            <span>{isSnapping ? "Snap On" : "Snap Off"}</span>
          </button>

          {/* Split clip button */}
          <button
            onClick={handleTriggerSplit}
            disabled={!selectedNode || currentTime <= selectedNode.start || currentTime >= selectedNode.end}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-indigo-400 disabled:opacity-40 disabled:hover:text-slate-500 disabled:cursor-not-allowed rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer"
            title="Split selected clip exactly at playhead time code"
          >
            <Scissors className="w-3 h-3" />
            <span>Split Clip</span>
          </button>
        </div>

        {/* Zoom controls & Insert Action */}
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          
          {/* Zoom Slider Panel */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setScalePx((prev) => Math.max(8, prev - 6))}
              disabled={scalePx <= 8}
              className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 cursor-pointer"
              title="Zoom Out Timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="8"
              max="128"
              value={scalePx}
              onChange={(e) => setScalePx(parseInt(e.target.value))}
              className="w-20 sm:w-28 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <button
              onClick={() => setScalePx((prev) => Math.min(128, prev + 6))}
              disabled={scalePx >= 128}
              className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 cursor-pointer"
              title="Zoom In Timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[8px] text-slate-500 font-mono w-6 text-right">
              {Math.round((scalePx / 32) * 100)}%
            </span>
          </div>

          <button
            onClick={onAddNode}
            className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono border border-indigo-500/30 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Insert Clip</span>
          </button>
        </div>

      </div>

      {/* Main Multi-Track Canvas layout */}
      <div className="flex-1 min-h-0 flex flex-row items-stretch bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden relative">
        
        {/* TRACK HEAD COLUMNS (NLE Track Controls) */}
        <div className="w-44 shrink-0 bg-slate-900 border-r border-slate-800/90 flex flex-col z-20">
          
          {/* Empty Space representing the Time Ruler header */}
          <div className="h-7 shrink-0 border-b border-slate-800/85 bg-slate-950 flex items-center justify-between px-2.5 select-none">
            <span className="text-[8.5px] font-mono font-black uppercase tracking-wider text-slate-500">Track Control</span>
            <span className="text-[8px] bg-slate-800 border border-slate-700/60 px-1 py-0.2 rounded text-slate-400 font-sans">NLE</span>
          </div>

          {/* Scrollable Track Heads */}
          <div 
            ref={trackHeadsRef}
            onWheel={handleHeadsWheel}
            className="flex-1 overflow-hidden flex flex-col scrollbar-none"
          >
            {/* V2 Top Video Track Head */}
            <div className={`h-12 border-b border-slate-800/60 px-2 py-1 flex flex-col justify-between shrink-0 transition-all border-l-2 ${
              soloedTracks.includes(2) ? "border-l-indigo-400 bg-indigo-950/20" : "border-l-indigo-600 bg-slate-950/40"
            } ${hiddenTracks.includes(2) ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-indigo-400 font-mono flex items-center space-x-1">
                  <Video className="w-2.5 h-2.5 text-indigo-400" />
                  <span className="truncate">V2 Overlay</span>
                </span>
                <span className="text-[7px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-900 px-0.5 rounded-sm">OVER</span>
              </div>
              {/* Track controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onToggleTrackVisibility?.(2)}
                    className={`p-0.5 rounded transition-colors cursor-pointer ${
                      hiddenTracks.includes(2) 
                        ? "bg-rose-950 text-rose-400 border border-rose-900/60" 
                        : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    title={hiddenTracks.includes(2) ? "Show V2 Overlay Layer" : "Hide V2 Overlay Layer"}
                  >
                    {hiddenTracks.includes(2) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={() => toggleTrackLock(2)}
                    className={`p-0.5 rounded transition-colors cursor-pointer ${
                      lockedTracks.includes(2) 
                        ? "bg-amber-950 text-amber-400 border border-amber-900/60" 
                        : "bg-slate-800/60 hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                    }`}
                    title={lockedTracks.includes(2) ? "Unlock Layer V2" : "Lock Layer V2"}
                  >
                    {lockedTracks.includes(2) ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                  </button>
                </div>

                {/* Pro Solo button */}
                <button
                  onClick={() => toggleTrackSolo(2)}
                  className={`p-0.5 rounded transition-all cursor-pointer flex items-center justify-center ${
                    soloedTracks.includes(2) 
                      ? "bg-indigo-600 text-white font-extrabold" 
                      : "bg-slate-800/40 hover:bg-slate-800 text-slate-600 hover:text-slate-400"
                  }`}
                  title="Solo Track"
                >
                  <Radio className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* V1 Main Video Track Head */}
            <div className={`h-12 border-b border-slate-800/60 px-2 py-1 flex flex-col justify-between shrink-0 transition-all border-l-2 ${
              soloedTracks.includes(1) ? "border-l-sky-400 bg-sky-950/20" : "border-l-sky-600 bg-slate-950/40"
            } ${hiddenTracks.includes(1) ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-sky-400 font-mono flex items-center space-x-1">
                  <Video className="w-2.5 h-2.5 text-sky-400" />
                  <span className="truncate">V1 Primary</span>
                </span>
                <span className="text-[7px] font-mono bg-sky-950 text-sky-300 border border-sky-900 px-0.5 rounded-sm">BASE</span>
              </div>
              {/* Track controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onToggleTrackVisibility?.(1)}
                    className={`p-0.5 rounded transition-colors cursor-pointer ${
                      hiddenTracks.includes(1) 
                        ? "bg-rose-950 text-rose-400 border border-rose-900/60" 
                        : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    title={hiddenTracks.includes(1) ? "Show V1 Primary Layer" : "Hide V1 Primary Layer"}
                  >
                    {hiddenTracks.includes(1) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={() => toggleTrackLock(1)}
                    className={`p-0.5 rounded transition-colors cursor-pointer ${
                      lockedTracks.includes(1) 
                        ? "bg-amber-950 text-amber-400 border border-amber-900/60" 
                        : "bg-slate-800/60 hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                    }`}
                    title={lockedTracks.includes(1) ? "Unlock Layer V1" : "Lock Layer V1"}
                  >
                    {lockedTracks.includes(1) ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                  </button>
                </div>

                {/* Pro Solo button */}
                <button
                  onClick={() => toggleTrackSolo(1)}
                  className={`p-0.5 rounded transition-all cursor-pointer flex items-center justify-center ${
                    soloedTracks.includes(1) 
                      ? "bg-sky-600 text-white font-extrabold" 
                      : "bg-slate-800/40 hover:bg-slate-800 text-slate-600 hover:text-slate-400"
                  }`}
                  title="Solo Track"
                >
                  <Radio className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>

            {/* Subtitle / Captions Track Head */}
            <div className="h-8 shrink-0 px-2 flex items-center justify-between bg-slate-950/20 border-b border-slate-800/60 border-l-2 border-l-violet-600">
              <span className="text-[9px] font-bold text-violet-400 font-mono flex items-center space-x-1">
                <MessageSquare className="w-2.5 h-2.5 text-violet-400" />
                <span>Captions</span>
              </span>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => toggleTrackMute(3)}
                  className={`p-0.5 rounded transition-colors cursor-pointer ${mutedTracks.includes(3) ? "text-rose-400" : "text-slate-500 hover:text-slate-300"}`}
                  title="Disable/Hide Captions Rendering"
                >
                  <Type className="w-2.5 h-2.5" />
                </button>
                <Settings className="w-2.5 h-2.5 text-slate-600 hover:text-slate-400 cursor-pointer" title="Captions Style Editor" />
              </div>
            </div>

            {/* Master Voice/Audio Track Head */}
            <div className="h-10 shrink-0 px-2 py-0.5 flex flex-col justify-between bg-slate-950/10 border-l-2 border-l-emerald-600">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-emerald-400 font-mono flex items-center space-x-1">
                  <Music className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="truncate">Voice Track</span>
                </span>
                <button
                  onClick={() => toggleTrackMute(4)}
                  className={`p-0.5 rounded transition-all cursor-pointer ${
                    mutedTracks.includes(4) ? "text-rose-400" : "text-emerald-500 hover:text-emerald-300"
                  }`}
                  title="Mute Master Audio Output"
                >
                  {mutedTracks.includes(4) ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                </button>
              </div>
              
              <div className="flex items-center justify-between text-[7px] text-slate-500 font-mono select-none">
                <div className="flex items-center space-x-1">
                  <Activity className="w-2 h-2 text-emerald-500 animate-pulse" />
                  <span>TTS Master</span>
                </div>
                <span className="text-emerald-400/80 font-bold">100%</span>
              </div>
            </div>

          </div>

        </div>

        {/* TRACKS CONTENT PANELS (Scrollable Timeline Area) */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onMouseMove={handleContainerMouseMove}
          onMouseLeave={handleContainerMouseLeave}
          className="flex-1 overflow-auto pb-1 relative scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent custom-timeline-viewport"
        >
          <div 
            style={{ width: `${trackWidth}px` }} 
            className="relative select-none h-full"
          >
            
            {/* HOVER CURSOR LINE (Vertical line with floating precise timestamp) */}
            {hoverX !== null && !isScrubbing && (
              <div 
                style={{ left: `${hoverX}px` }}
                className="absolute top-0 bottom-0 w-[1.5px] bg-sky-400/35 border-l border-dashed border-sky-400/50 z-20 pointer-events-none"
              >
                {/* Floating precise time tooltip */}
                <div className="absolute top-7 transform -translate-x-1/2 bg-sky-500 text-slate-950 font-bold font-mono text-[8px] px-1.5 py-0.5 rounded shadow-md border border-sky-400/30 whitespace-nowrap">
                  {formatTime(hoverX / scalePx)}
                </div>
              </div>
            )}

            {/* END OF VIDEO LINE & FLAG (Show timestamp till last clip) */}
            {totalDuration > 0 && (
              <div 
                style={{ left: `${totalDuration * scalePx}px` }}
                className="absolute top-0 bottom-0 w-[1.5px] border-l border-dashed border-amber-500/55 z-15 pointer-events-none"
              >
                {/* Visual marker flag representing the exact end of video timeline */}
                <div className="absolute top-[32px] transform -translate-x-1/2 bg-amber-500 text-slate-950 font-sans font-black text-[8px] px-1.5 py-0.5 rounded shadow border border-amber-400/60 whitespace-nowrap tracking-wide">
                  End: {formatTime(totalDuration)}
                </div>
              </div>
            )}

            {/* 1. Dynamic Time Ruler track */}
            <div 
              onMouseDown={startScrubbing}
              className="h-7 border-b border-slate-800 bg-slate-900/50 relative cursor-ew-resize hover:bg-slate-900 transition-colors"
              title="Click and drag to scrub playhead cursor"
            >
              {renderRulerTicks()}
            </div>

            {/* 2. Top Visual Track V2 (Overlays / B-Rolls) */}
            <div className={`h-12 border-b border-slate-800/40 relative transition-all ${hiddenTracks.includes(2) ? "bg-slate-950/45 opacity-25" : "bg-slate-950/30"}`}>
              {timeline
                .filter((node) => node.track === 2)
                .map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isActive = currentTime >= node.start && currentTime <= node.end;
                  const duration = node.end - node.start;
                  const nodeLeft = node.start * scalePx;
                  const nodeWidth = duration * scalePx;
                  const locked = isNodeLocked(node);

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectNode(node)}
                      onMouseDown={startDragClip(node)}
                      style={{ 
                        left: `${nodeLeft}px`, 
                        width: `${nodeWidth}px` 
                      }}
                      className={`absolute top-1 bottom-1 rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing transition-all select-none z-10 ${
                        isActive && !hiddenTracks.includes(2)
                          ? "border-sky-400 bg-slate-900 shadow-md shadow-sky-500/15 ring-1 ring-sky-400/30" 
                          : isSelected
                          ? "border-indigo-400 bg-slate-900 ring-1 ring-indigo-400/30"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                      }`}
                    >
                      {/* Visual Thumbnail or Placeholder */}
                      <div className="w-full h-full relative group">
                        {node.imageUrl ? (
                          <img 
                            src={node.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-700" />
                          </div>
                        )}

                        {/* Info Overlay */}
                        <div className="absolute inset-0 p-1 flex flex-col justify-between bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none select-none">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 pointer-events-auto">
                              <span className="text-[8px] font-mono bg-slate-950/90 px-1 py-0.5 rounded text-slate-300">
                                {duration.toFixed(1)}s
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateNode(node.id, { isLocked: !node.isLocked });
                                }}
                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                  node.isLocked 
                                    ? "bg-amber-500/25 text-amber-400 hover:bg-amber-500/40" 
                                    : "bg-slate-950/80 text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                                }`}
                                title={node.isLocked ? "Unlock Clip Duration" : "Lock Clip Duration"}
                              >
                                {node.isLocked ? (
                                  <Lock className="w-2.5 h-2.5" />
                                ) : (
                                  <Unlock className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                            {node.isAiGenerated && (
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                            )}
                          </div>
                          <span className="text-[8px] font-mono truncate text-sky-400 font-bold bg-slate-950/95 px-1 py-0.5 rounded border border-slate-800/40 max-w-[95%]">
                            {node.searchQuery || "clip"}
                          </span>
                        </div>

                        {/* Left Resize Handle */}
                        {!locked && (
                          <div
                            onMouseDown={startResize(node, "left")}
                            className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-sky-400/50 cursor-col-resize z-25 flex items-center justify-center group/left"
                            title="Drag to resize start boundary"
                          >
                            <div className="w-[1.5px] h-4 bg-sky-400/40 group-hover/left:bg-sky-400 rounded-full"></div>
                          </div>
                        )}

                        {/* Right Resize Handle */}
                        {!locked && (
                          <div
                            onMouseDown={startResize(node, "right")}
                            className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-sky-400/50 cursor-col-resize z-25 flex items-center justify-center group/right"
                            title="Drag to stretch/compress duration"
                          >
                            <div className="w-[1.5px] h-4 bg-sky-400/40 group-hover/right:bg-sky-400 rounded-full"></div>
                          </div>
                        )}

                        {/* Speed Hover Action Controls */}
                        <div className="absolute inset-0 bg-slate-950/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeekTo(node.start);
                            }}
                            className="p-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
                            title="Seek To Clip"
                          >
                            <Play className="w-3 h-3 fill-slate-950 text-slate-950" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateAIImage(node.id);
                            }}
                            disabled={node.isGenerating}
                            className="p-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded transition-colors disabled:opacity-50"
                            title="Generate AI Illustration"
                          >
                            {node.isGenerating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNode(node.id);
                            }}
                            className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                            title="Delete Clip"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* 3. Main Visual Track V1 (Default/Main Layer) */}
            <div className={`h-12 border-b border-slate-800/40 relative transition-all ${hiddenTracks.includes(1) ? "bg-slate-950/45 opacity-25" : "bg-slate-950/30"}`}>
              {timeline
                .filter((node) => !node.track || node.track === 1)
                .map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isActive = currentTime >= node.start && currentTime <= node.end;
                  const duration = node.end - node.start;
                  const nodeLeft = node.start * scalePx;
                  const nodeWidth = duration * scalePx;
                  const locked = isNodeLocked(node);

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectNode(node)}
                      onMouseDown={startDragClip(node)}
                      style={{ 
                        left: `${nodeLeft}px`, 
                        width: `${nodeWidth}px` 
                      }}
                      className={`absolute top-1 bottom-1 rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing transition-all select-none z-10 ${
                        isActive && !hiddenTracks.includes(1)
                          ? "border-sky-400 bg-slate-900 shadow-md shadow-sky-500/15 ring-1 ring-sky-400/30" 
                          : isSelected
                          ? "border-indigo-400 bg-slate-900 ring-1 ring-indigo-400/30"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                      }`}
                    >
                      {/* Visual Thumbnail or Placeholder */}
                      <div className="w-full h-full relative group">
                        {node.imageUrl ? (
                          <img 
                            src={node.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-700" />
                          </div>
                        )}

                        {/* Info Overlay */}
                        <div className="absolute inset-0 p-1 flex flex-col justify-between bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none select-none">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1 pointer-events-auto">
                              <span className="text-[8px] font-mono bg-slate-950/90 px-1 py-0.5 rounded text-slate-300">
                                {duration.toFixed(1)}s
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateNode(node.id, { isLocked: !node.isLocked });
                                }}
                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                  node.isLocked 
                                    ? "bg-amber-500/25 text-amber-400 hover:bg-amber-500/40" 
                                    : "bg-slate-950/80 text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                                }`}
                                title={node.isLocked ? "Unlock Clip Duration" : "Lock Clip Duration"}
                              >
                                {node.isLocked ? (
                                  <Lock className="w-2.5 h-2.5" />
                                ) : (
                                  <Unlock className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                            {node.isAiGenerated && (
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                            )}
                          </div>
                          <span className="text-[8px] font-mono truncate text-sky-400 font-bold bg-slate-950/95 px-1 py-0.5 rounded border border-slate-800/40 max-w-[95%]">
                            {node.searchQuery || "clip"}
                          </span>
                        </div>

                        {/* Left Resize Handle */}
                        {!locked && (
                          <div
                            onMouseDown={startResize(node, "left")}
                            className="absolute left-0 top-0 bottom-0 w-2.5 hover:bg-sky-400/50 cursor-col-resize z-25 flex items-center justify-center group/left"
                            title="Drag to resize start boundary"
                          >
                            <div className="w-[1.5px] h-4 bg-sky-400/40 group-hover/left:bg-sky-400 rounded-full"></div>
                          </div>
                        )}

                        {/* Right Resize Handle */}
                        {!locked && (
                          <div
                            onMouseDown={startResize(node, "right")}
                            className="absolute right-0 top-0 bottom-0 w-2.5 hover:bg-sky-400/50 cursor-col-resize z-25 flex items-center justify-center group/right"
                            title="Drag to stretch/compress duration"
                          >
                            <div className="w-[1.5px] h-4 bg-sky-400/40 group-hover/right:bg-sky-400 rounded-full"></div>
                          </div>
                        )}

                        {/* Speed Hover Action Controls */}
                        <div className="absolute inset-0 bg-slate-950/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1.5 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeekTo(node.start);
                            }}
                            className="p-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
                            title="Seek To Clip"
                          >
                            <Play className="w-3 h-3 fill-slate-950 text-slate-950" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateAIImage(node.id);
                            }}
                            disabled={node.isGenerating}
                            className="p-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded transition-colors disabled:opacity-50"
                            title="Generate AI Illustration"
                          >
                            {node.isGenerating ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNode(node.id);
                            }}
                            className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                            title="Delete Clip"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* 4. Subtitles / Captions Track */}
            <div className="h-8 bg-slate-950/20 border-b border-slate-800/40 relative">
              {timeline.map((node) => {
                const duration = node.end - node.start;
                const nodeLeft = node.start * scalePx;
                const nodeWidth = duration * scalePx;
                const isSelected = selectedNode?.id === node.id;

                return (
                  <div
                    key={`cap-${node.id}`}
                    onClick={() => onSelectNode(node)}
                    style={{ 
                      left: `${nodeLeft}px`, 
                      width: `${nodeWidth}px` 
                    }}
                    className={`absolute top-0.5 bottom-0.5 rounded-md px-2 py-0.5 border cursor-pointer flex items-center overflow-hidden text-ellipsis transition-colors ${
                      isSelected 
                        ? "bg-violet-950/50 border-violet-500 text-violet-200" 
                        : "bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700/80"
                    }`}
                  >
                    <p className="text-[9px] font-mono truncate leading-tight text-left select-none" title={node.text}>
                      "{node.text}"
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 5. Master Voice/Audio Track (Stellar continuous waveform visualization) */}
            <div className="h-10 bg-emerald-950/10 relative overflow-hidden flex items-center">
              {/* Draw a gorgeous procedural waveform along the timeline */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-start pointer-events-none opacity-40 px-4 space-x-[2px] w-full">
                {audioBars.map((barHeight, idx) => (
                  <div 
                    key={idx} 
                    style={{ height: `${barHeight}px` }} 
                    className={`w-[3px] rounded-full transition-all ${
                      currentTime >= (idx / audioBars.length) * (totalDuration + 5)
                        ? "bg-emerald-400 shadow-md shadow-emerald-400/20" 
                        : "bg-emerald-800"
                    }`}
                  />
                ))}
              </div>
              
              {/* Render small visual guides on active nodes */}
              {timeline.map((node) => {
                const nodeLeft = node.start * scalePx;
                const nodeWidth = (node.end - node.start) * scalePx;
                return (
                  <div 
                    key={`aud-node-${node.id}`}
                    style={{ left: `${nodeLeft}px`, width: `${nodeWidth}px` }}
                    className="absolute inset-y-0 border-l border-r border-dashed border-emerald-500/20 pointer-events-none"
                  />
                );
              })}
            </div>

            {/* 6. RED MASTER PLAYHEAD LINE */}
            <div 
              style={{ left: `${currentTime * scalePx}px` }}
              className="absolute top-0 bottom-0 w-[2.5px] bg-rose-500 z-30 pointer-events-none transition-all duration-75 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            >
              {/* Playhead thumb head */}
              <div className="absolute top-0 -left-[6px] w-[13px] h-[13px] bg-rose-500 rotate-45 border border-rose-400 shadow-md"></div>
              {/* Clean high-contrast playhead timecode bubble inside the ruler */}
              <div className="absolute top-2.5 left-1.5 bg-rose-600 text-white font-mono font-bold text-[8px] px-1 rounded shadow-md border border-rose-400 z-35 select-none pointer-events-none">
                {formatTime(currentTime)}
              </div>
              {/* Visual laser play line */}
              <div className="w-[1.5px] h-full bg-rose-500/40 absolute left-0 top-0"></div>
            </div>

          </div>
        </div>
      </div>

      {/* Interactive Legend and NLE Engine Version Metadata */}
      <div className="text-[10px] text-slate-500 font-mono mt-2.5 flex flex-wrap justify-between gap-2 border-t border-slate-800/60 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Drag Clip</span> move in time • 
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Drag Up/Down</span> switch layers • 
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Drag Edge</span> adjust duration
        </span>
        <span className="text-indigo-400 font-bold flex items-center space-x-1">
          <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
          <span>[ V.Gen Studio NLE Engine v3.0 ]</span>
        </span>
      </div>
    </div>
  );
}
