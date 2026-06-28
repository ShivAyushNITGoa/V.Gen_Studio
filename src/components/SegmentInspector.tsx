import React, { useState, useEffect } from "react";
import { TimelineNode } from "../types";
import { 
  Sliders, Type, Clock, Image as ImageIcon, Sparkles, Trash2, 
  RefreshCcw, Search, Upload, Check, ChevronRight, Wand2
} from "lucide-react";
import { getUnsplashUrl } from "../utils";

interface SegmentInspectorProps {
  node: TimelineNode | null;
  onUpdateNode: (nodeId: string, updated: Partial<TimelineNode>) => void;
  onUpdateNodeDuration: (nodeId: string, duration: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onGenerateAIImage: (nodeId: string) => void;
  isGeneratingAll: boolean;
}

const FILTER_PRESETS = [
  { id: "none", name: "Normal / Original", desc: "No visual modifications" },
  { id: "vintage", name: "📼 Vintage Film", desc: "Warm nostalgic grade with deep shadows" },
  { id: "warm", name: "🌅 Golden Warmth", desc: "Cozy sunset hues and rich saturation" },
  { id: "cool", name: "❄️ Nordic Cool", desc: "Chilly blue tint and clean highlights" },
  { id: "mono", name: "🎞️ Noir Monochrome", desc: "High contrast black and white cinematic" },
  { id: "sepia", name: "📜 Antique Sepia", desc: "Elegant historical sepia coloration" },
  { id: "invert", name: "🎨 Color Invert", desc: "Artistic inverted negative spectrum" },
  { id: "sketch", name: "✏️ High-Contrast Sketch", desc: "Gritty charcoal sketch feel" }
];

export default function SegmentInspector({
  node,
  onUpdateNode,
  onUpdateNodeDuration,
  onDeleteNode,
  onGenerateAIImage,
  isGeneratingAll
}: SegmentInspectorProps) {
  const [activeTab, setActiveTab] = useState<"visuals" | "filters" | "text">("text");
  const [customUrl, setCustomUrl] = useState("");
  const [durationInput, setDurationInput] = useState("");

  useEffect(() => {
    if (node) {
      setCustomUrl(node.imageUrl && !node.imageUrl.startsWith("data:") ? node.imageUrl : "");
      setDurationInput((node.end - node.start).toFixed(1));
    }
  }, [node]);

  if (!node) {
    return (
      <div id="segment-inspector-empty" className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl flex flex-col items-center justify-center text-center h-full min-h-[300px]">
        <div className="p-4 bg-slate-950 rounded-full mb-4 border border-slate-800">
          <Sliders className="w-8 h-8 text-slate-600" />
        </div>
        <h4 className="text-slate-300 font-bold mb-1">No Storyboard Block Selected</h4>
        <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
          Click any visual segment on the timeline below to edit captions, customize durations, apply cinematic filters, or regenerate visuals.
        </p>
      </div>
    );
  }

  const duration = node.end - node.start;

  // Handle duration edit submit
  const handleDurationChange = (val: string) => {
    setDurationInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0.1 && parsed <= 60) {
      onUpdateNodeDuration(node.id, parsed);
    }
  };

  const adjustDurationBy = (amount: number) => {
    const nextDur = Math.max(0.5, Math.min(60, duration + amount));
    setDurationInput(nextDur.toFixed(1));
    onUpdateNodeDuration(node.id, nextDur);
  };

  // Convert uploaded custom file to Base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onUpdateNode(node.id, { imageUrl: base64, isAiGenerated: false });
      }
    };
    reader.readAsDataURL(file);
  };

  // Fetch new high-quality stock photo
  const handleRefreshStock = () => {
    const query = node.searchQuery || "scenic abstract art";
    const freshUrl = getUnsplashUrl(query, node.id + "_" + Date.now());
    onUpdateNode(node.id, { imageUrl: freshUrl, isAiGenerated: false });
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onUpdateNode(node.id, { imageUrl: customUrl.trim(), isAiGenerated: false });
    }
  };

  return (
    <div id={`segment-inspector-${node.id}`} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Inspector Header */}
      <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-100 font-mono uppercase tracking-wider">Block Editor</h3>
            <p className="text-[10px] text-slate-500 font-mono">Editing block: <span className="text-indigo-400 font-bold">{node.id.split("_").pop()}</span></p>
          </div>
        </div>

        <button
          onClick={() => onDeleteNode(node.id)}
          className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-lg transition-all cursor-pointer"
          title="Delete storyboard segment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Selector Tabs */}
      <div className="grid grid-cols-3 bg-slate-950/40 border-b border-slate-800/80 p-1">
        <button
          onClick={() => setActiveTab("text")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "text"
              ? "bg-slate-800 text-sky-400 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Script & Timing</span>
        </button>
        <button
          onClick={() => setActiveTab("visuals")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "visuals"
              ? "bg-slate-800 text-indigo-400 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Visual Artwork</span>
        </button>
        <button
          onClick={() => setActiveTab("filters")}
          className={`flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === "filters"
              ? "bg-slate-800 text-emerald-400 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Effects & Filters</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent space-y-4">
        
        {/* TAB 1: SCRIPT & TIMING */}
        {activeTab === "text" && (
          <div className="space-y-4 animate-fade-in">
            {/* Subtitle Words */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                <Type className="w-3.5 h-3.5 text-sky-400" />
                <span>Spoken Text & Subtitle Caption</span>
              </label>
              <textarea
                value={node.text}
                onChange={(e) => onUpdateNode(node.id, { text: e.target.value })}
                placeholder="Type the spoken dialogue or subtitle caption for this segment..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all placeholder:text-slate-600 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Block duration adjustment */}
            <div className="space-y-1.5 bg-slate-950/60 p-4 border border-slate-800/60 rounded-xl">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Segment Display Duration</span>
              </label>
              <div className="flex items-center space-x-3 mt-2">
                <button
                  type="button"
                  onClick={() => adjustDurationBy(-1.0)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Decrease 1 second"
                >
                  -1.0s
                </button>
                <button
                  type="button"
                  onClick={() => adjustDurationBy(-0.1)}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Decrease 0.1 seconds"
                >
                  -0.1s
                </button>

                <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                  <input
                    type="number"
                    value={durationInput}
                    min="0.1"
                    max="60"
                    step="0.1"
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full bg-transparent text-center text-sm font-bold font-mono text-sky-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 ml-1 font-mono font-bold">sec</span>
                </div>

                <button
                  type="button"
                  onClick={() => adjustDurationBy(0.1)}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Increase 0.1 seconds"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustDurationBy(1.0)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  title="Increase 1 second"
                >
                  +1.0s
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2 italic leading-relaxed">
                👉 Changing this automatically shifts all subsequent nodes forward or backward keeping the timeline contiguous and fully synchronized.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: VISUAL ARTWORK */}
        {activeTab === "visuals" && (
          <div className="space-y-4 animate-fade-in">
            {/* Unsplash Search Tag */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 font-mono uppercase">Unsplash Tag</label>
                <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={node.searchQuery || ""}
                    onChange={(e) => onUpdateNode(node.id, { searchQuery: e.target.value })}
                    className="w-full bg-transparent text-xs text-slate-200 focus:outline-none py-1 placeholder:text-slate-700"
                    placeholder="Stock search keywords..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 font-mono uppercase">AI Prompt</label>
                <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                  <Wand2 className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={node.prompt || ""}
                    onChange={(e) => onUpdateNode(node.id, { prompt: e.target.value })}
                    className="w-full bg-transparent text-xs text-slate-200 focus:outline-none py-1 placeholder:text-slate-700"
                    placeholder="Describe scene for AI image..."
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleRefreshStock}
                className="py-2.5 px-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-mono transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Fetch Stock Image</span>
              </button>

              <button
                type="button"
                onClick={() => onGenerateAIImage(node.id)}
                disabled={node.isGenerating || isGeneratingAll}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-mono transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {node.isGenerating ? (
                  <>
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI Visual</span>
                  </>
                )}
              </button>
            </div>

            <div className="border-t border-slate-800/80 my-3"></div>

            {/* Upload or Custom URL options */}
            <div className="space-y-3">
              <div className="bg-slate-950/40 border border-dashed border-slate-800 hover:border-slate-700 p-4 rounded-xl text-center relative transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <span className="text-xs text-slate-300 font-bold block mb-0.5">Upload Custom Visual</span>
                <span className="text-[10px] text-slate-500 font-mono block">Supports JPG, PNG, WebP</span>
              </div>

              <form onSubmit={handleApplyCustomUrl} className="flex space-x-1.5">
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste external image URL directly..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-700"
                />
                <button
                  type="submit"
                  disabled={!customUrl.trim()}
                  className="px-3 bg-slate-850 hover:bg-slate-700 disabled:bg-slate-950 disabled:text-slate-700 border border-slate-800 text-slate-200 font-bold text-xs rounded-xl transition-all"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: EFFECTS & FILTERS (Advanced Visual Adjustments) */}
        {activeTab === "filters" && (
          <div className="space-y-5 animate-fade-in">
            {/* Color filter presets */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 font-mono uppercase">Cinematic Film Filters</label>
                {node.filter && node.filter !== "none" && (
                  <button
                    onClick={() => onUpdateNode(node.id, { filter: "none" })}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 font-mono"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FILTER_PRESETS.map((p) => {
                  const isApplied = node.filter === p.id || (!node.filter && p.id === "none");
                  return (
                    <button
                      key={p.id}
                      onClick={() => onUpdateNode(node.id, { filter: p.id as any })}
                      className={`p-2.5 text-left rounded-xl border text-xs transition-all flex flex-col justify-between cursor-pointer ${
                        isApplied
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-750"
                      }`}
                      title={p.desc}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{p.name}</span>
                        {isApplied && <Check className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-800/80 my-3"></div>

            {/* Custom Sliders: Brightness, Contrast, Saturation, Blur */}
            <div className="space-y-4 bg-slate-950/50 p-4 border border-slate-800/40 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 font-mono uppercase flex items-center space-x-1">
                  <span>Manual Adjustments</span>
                </label>
                <button
                  onClick={() => onUpdateNode(node.id, { brightness: 100, contrast: 100, saturation: 100, blur: 0 })}
                  className="text-[10px] text-slate-500 hover:text-slate-300 font-mono flex items-center space-x-0.5"
                  title="Reset sliders to defaults"
                >
                  <RefreshCcw className="w-2.5 h-2.5" />
                  <span>Reset All</span>
                </button>
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Brightness</span>
                  <span className="text-emerald-400 font-bold">{node.brightness !== undefined ? node.brightness : 100}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={node.brightness !== undefined ? node.brightness : 100}
                  onChange={(e) => onUpdateNode(node.id, { brightness: parseInt(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Contrast</span>
                  <span className="text-emerald-400 font-bold">{node.contrast !== undefined ? node.contrast : 100}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={node.contrast !== undefined ? node.contrast : 100}
                  onChange={(e) => onUpdateNode(node.id, { contrast: parseInt(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Saturation</span>
                  <span className="text-emerald-400 font-bold">{node.saturation !== undefined ? node.saturation : 100}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={node.saturation !== undefined ? node.saturation : 100}
                  onChange={(e) => onUpdateNode(node.id, { saturation: parseInt(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Blur */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>Blur defocus</span>
                  <span className="text-emerald-400 font-bold">{node.blur !== undefined ? node.blur : 0}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={node.blur !== undefined ? node.blur : 0}
                  onChange={(e) => onUpdateNode(node.id, { blur: parseInt(e.target.value) })}
                  className="w-full accent-emerald-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
