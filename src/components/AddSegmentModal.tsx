import React, { useState } from "react";
import { X, Type, Wand2, Search, Clock, Plus, Sparkles } from "lucide-react";

interface AddSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    text: string;
    prompt: string;
    searchQuery: string;
    duration: number;
  }) => void;
}

export default function AddSegmentModal({ isOpen, onClose, onAdd }: AddSegmentModalProps) {
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [duration, setDuration] = useState(5.0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    onAdd({
      text: text.trim(),
      prompt: prompt.trim() || "A gorgeous scenic landscape, cinematic style",
      searchQuery: searchQuery.trim() || "cinematic scene",
      duration: Number(duration) || 5.0,
    });

    // Reset fields
    setText("");
    setPrompt("");
    setSearchQuery("");
    setDuration(5.0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        id="add-segment-modal"
        className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono uppercase tracking-wider">
                Create Storyboard Clip
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Add a customized segment to your editing track</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Spoken Dialog */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>Spoken Dialogue / Caption Text <span className="text-red-500">*</span></span>
            </label>
            <textarea
              required
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Auto-suggest search query & prompt if they are empty
                if (!searchQuery && e.target.value) {
                  const words = e.target.value.split(" ").slice(0, 3).join(" ");
                  setSearchQuery(words.replace(/[^a-zA-Z ]/g, ""));
                }
              }}
              placeholder="What should the voice actor speak during this segment?"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-600 resize-none font-sans leading-relaxed"
            />
          </div>

          {/* AI Image Generation Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>AI Image Generation Prompt</span>
              <span className="text-[10px] font-normal text-slate-500 font-mono">(Used by Imagen API)</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A gorgeous scenic landscape in sunset, cinematic movie shot style"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Unsplash Search Tag */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span>Stock Search Tag</span>
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. sunset landscape"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-700"
              />
            </div>

            {/* Segment Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Clip Duration</span>
              </label>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2">
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value) || 5.0)}
                  className="w-full bg-transparent text-xs font-bold font-mono text-amber-400 focus:outline-none text-center"
                />
                <span className="text-[10px] text-slate-500 font-mono font-bold">sec</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3 border-t border-slate-800/50 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-xs font-mono rounded-xl transition-all shadow-md flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
              <span>Insert Clip</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
