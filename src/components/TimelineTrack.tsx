import React, { useRef } from "react";
import { TimelineNode } from "../types";
import { Play, Sparkles, Trash2, Plus, Image as ImageIcon, Loader2, Scissors, Music } from "lucide-react";
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
}: TimelineTrackProps) {
  // Width scaling: 1 second = 32 pixels
  const scalePx = 32;
  const totalDuration = timeline.length > 0 ? timeline[timeline.length - 1].end : 0;
  const trackWidth = Math.max(800, totalDuration * scalePx);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Handle click on the time ruler to seek directly
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seconds = clickX / scalePx;
    onSeekTo(Math.max(0, Math.min(totalDuration, seconds)));
  };

  // Generate tick marks for the ruler
  const renderRulerTicks = () => {
    const ticks = [];
    const step = 2; // Tick mark every 2 seconds
    const maxTime = Math.ceil(totalDuration) + 10;
    
    for (let s = 0; s <= maxTime; s += step) {
      ticks.push(
        <div 
          key={s} 
          style={{ left: `${s * scalePx}px` }} 
          className="absolute top-0 bottom-0 flex flex-col justify-between items-start pointer-events-none select-none"
        >
          {/* Hour/Minute/Second tick label */}
          <span className="text-[9px] font-mono font-bold text-slate-500 pl-1 pt-0.5">
            {formatTime(s)}
          </span>
          {/* Tick indicator line */}
          <div className="w-[1px] h-2 bg-slate-700"></div>
        </div>
      );
    }
    return ticks;
  };

  return (
    <div id="timeline-track-root" className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col h-full select-none">
      {/* Track Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5 items-center px-2 py-1 bg-slate-950 rounded-md border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 font-sans tracking-wide">Clips</span>
          </div>
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Total Playback: <span className="text-sky-400 font-bold">{totalDuration.toFixed(1)}s</span>
          </span>
        </div>

        <button
          onClick={onAddNode}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono border border-indigo-500/30 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Insert Clip</span>
        </button>
      </div>

      {/* Main Editing Timelines Wrapper */}
      <div className="flex flex-row items-stretch bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
        
        {/* Track Identifiers (Left Header Column) */}
        <div className="w-24 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col pt-9">
          
          {/* Video track head */}
          <div className="h-28 border-b border-slate-800/60 px-2 flex flex-col justify-center bg-slate-950/40">
            <span className="text-[10px] font-bold text-sky-400 font-mono flex items-center space-x-1">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Visuals</span>
            </span>
          </div>

          {/* Subtitle track head */}
          <div className="h-16 px-2 flex flex-col justify-center bg-slate-950/20">
            <span className="text-[10px] font-bold text-violet-400 font-mono flex items-center space-x-1">
              <Scissors className="w-3.5 h-3.5" />
              <span>Captions</span>
            </span>
          </div>
        </div>

        {/* Tracks Content Viewport (Horizontal Scroll Pane) */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden pb-1 relative scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
        >
          <div 
            style={{ width: `${trackWidth}px` }} 
            className="relative select-none h-full"
          >
            
            {/* 1. Time ruler track */}
            <div 
              onClick={handleRulerClick}
              className="h-9 border-b border-slate-800 bg-slate-900/50 relative cursor-col-resize hover:bg-slate-900 transition-colors"
            >
              {renderRulerTicks()}
            </div>

            {/* 2. Video Clips Track */}
            <div className="h-28 border-b border-slate-800/60 bg-slate-950/30 relative">
              {timeline.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isActive = currentTime >= node.start && currentTime <= node.end;
                const duration = node.end - node.start;
                const nodeLeft = node.start * scalePx;
                const nodeWidth = duration * scalePx;

                return (
                  <div
                    key={node.id}
                    onClick={() => onSelectNode(node)}
                    style={{ 
                      left: `${nodeLeft}px`, 
                      width: `${nodeWidth}px` 
                    }}
                    className={`absolute top-1 bottom-1 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                      isActive 
                        ? "border-sky-400 bg-slate-900 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/30" 
                        : isSelected
                        ? "border-indigo-400 bg-slate-900 ring-1 ring-indigo-400/30"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                  >
                    {/* Visual Thumbnail */}
                    <div className="w-full h-full relative group">
                      {node.imageUrl ? (
                        <img 
                          src={node.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-slate-700" />
                        </div>
                      )}

                      {/* Info Overlay */}
                      <div className="absolute inset-0 p-1 flex flex-col justify-between bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono bg-slate-950/85 px-1 py-0.5 rounded text-slate-400">
                            {duration.toFixed(1)}s
                          </span>
                          {node.isAiGenerated && (
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                          )}
                        </div>
                        <span className="text-[9px] font-mono truncate text-sky-400 font-bold bg-slate-950/90 px-1 py-0.5 rounded">
                          {node.searchQuery || "clip"}
                        </span>
                      </div>

                      {/* Speed Hover Action Controls */}
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeekTo(node.start);
                          }}
                          className="p-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors"
                          title="Seek To Clip"
                        >
                          <Play className="w-2.5 h-2.5 fill-slate-950" />
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
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5" />
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
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Subtitles / Captions Track */}
            <div className="h-16 bg-slate-950/20 relative">
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
                    className={`absolute top-1 bottom-1 rounded-md px-2 py-1 border cursor-pointer flex items-center overflow-hidden text-ellipsis ${
                      isSelected 
                        ? "bg-violet-950/40 border-violet-500 text-violet-200" 
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <p className="text-[9px] font-mono truncate leading-normal text-left select-none" title={node.text}>
                      "{node.text}"
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 4. RED PLAYHEAD LINE */}
            <div 
              style={{ left: `${currentTime * scalePx}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none transition-all duration-75"
            >
              {/* Playhead thumb head */}
              <div className="absolute top-0 -left-[5px] w-3 h-3 bg-rose-500 rotate-45 border border-rose-400 shadow-md"></div>
            </div>

          </div>
        </div>
      </div>

      {/* Shortcuts & Status Legend */}
      <div className="text-[10px] text-slate-500 font-mono mt-2.5 flex flex-wrap justify-between gap-2">
        <span className="flex items-center gap-1">
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Space</span> Play/Pause • 
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">←</span>/
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">→</span> Skip 5s • 
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">F</span> Fullscreen • 
          <span className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">M</span> Mute
        </span>
        <span className="text-sky-400 font-bold">
          [ V.Gen Studio NLE Engine v2.0 ]
        </span>
      </div>
    </div>
  );
}
