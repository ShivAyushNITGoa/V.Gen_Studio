import React, { useState, useEffect } from "react";
import { VoiceOption, ImageStyleOption, VOICES, IMAGE_STYLES } from "../types";
import { Sparkles, MessageSquare, Mic, HelpCircle, Film, Settings2, RefreshCcw } from "lucide-react";

interface SidebarControlsProps {
  onGenerate: (params: {
    transcript: string;
    voiceName: string;
    errorLevel: string;
    imageStyle: string;
    speechSpeed: number;
  }) => void;
  isProcessing: boolean;
  projectSettings: {
    transcript: string;
    voiceName: string;
    errorLevel: string;
    imageStyle: string;
    speechSpeed: number;
  };
  onSettingsChange: (settings: {
    transcript: string;
    voiceName: string;
    errorLevel: string;
    imageStyle: string;
    speechSpeed: number;
  }) => void;
  onReset?: () => void;
  hasSavedProject?: boolean;
}

export default function SidebarControls({ 
  onGenerate, 
  isProcessing,
  projectSettings,
  onSettingsChange,
  onReset,
  hasSavedProject
}: SidebarControlsProps) {
  const { transcript, voiceName, errorLevel, imageStyle, speechSpeed } = projectSettings;
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Auto-dismiss confirmation state after 3 seconds of inactivity
  useEffect(() => {
    if (showConfirmReset) {
      const timer = setTimeout(() => {
        setShowConfirmReset(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmReset]);

  const handleResetClick = () => {
    if (showConfirmReset) {
      if (onReset) onReset();
      setShowConfirmReset(false);
    } else {
      setShowConfirmReset(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) return;
    onGenerate({
      transcript,
      voiceName,
      errorLevel,
      imageStyle,
      speechSpeed,
    });
  };

  return (
    <div id="sidebar-controls-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <Settings2 className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-slate-100 font-mono">Project Settings</h2>
        </div>
        {hasSavedProject && onReset && (
          <button
            type="button"
            onClick={handleResetClick}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
              showConfirmReset
                ? "bg-rose-600 text-white border border-rose-500 animate-pulse"
                : "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/35 text-rose-400"
            }`}
            title={showConfirmReset ? "Click again to confirm starting fresh" : "Clear all progress and start fresh"}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${showConfirmReset ? "animate-spin" : ""}`} />
            <span>{showConfirmReset ? "Confirm?" : "Reset"}</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          {/* Transcript input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Input Transcript</span>
              </label>
            </div>
            <textarea
              id="input-transcript"
              value={transcript}
              onChange={(e) => onSettingsChange({ ...projectSettings, transcript: e.target.value })}
              placeholder="Paste your voice-over script or transcript here..."
              rows={4}
              maxLength={1000}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none transition-all placeholder:text-slate-600 resize-none font-sans leading-relaxed"
            />
            <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
              <span>Supports up to 1000 characters</span>
              <span>{transcript.length}/1000</span>
            </div>
          </div>

          {/* Speech error level */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>Speech Error Rate (Humanize)</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {["None", "Mild", "High"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSettingsChange({ ...projectSettings, errorLevel: level })}
                  className={`py-1.5 px-2 rounded-xl border font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                    errorLevel === level
                      ? "bg-sky-500/10 border-sky-400 text-sky-400 shadow-md shadow-sky-500/5"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 font-mono italic leading-relaxed">
              {errorLevel === "None" && "• Fluent reading. Perfect grammar without interruptions."}
              {errorLevel === "Mild" && "• Introduces natural conversational pauses and gentle fillers ('um', 'uh')."}
              {errorLevel === "High" && "• Heavy realistic mistakes. Stutters, filled pauses, and speech corrections."}
            </p>
          </div>

          {/* Voice selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice Actor Profile</span>
            </label>
            <select
              id="voice-selector"
              value={voiceName}
              onChange={(e) => onSettingsChange({ ...projectSettings, voiceName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none transition-all cursor-pointer font-mono"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 font-mono">
              {VOICES.find((v) => v.id === voiceName)?.description}
            </p>
          </div>

          {/* Voice Speed Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                <span>Voice Speed (Speaking Rate)</span>
              </label>
              <span className="text-[10px] font-bold font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-md">
                {speechSpeed.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.4"
              step="0.05"
              value={speechSpeed}
              onChange={(e) => onSettingsChange({ ...projectSettings, speechSpeed: parseFloat(e.target.value) })}
              className="w-full accent-sky-400 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer border border-slate-800"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>Slower</span>
              <span>Normal</span>
              <span>Faster</span>
            </div>
          </div>

          {/* Image visual style */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" />
              <span>Storyboard Art Style</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {IMAGE_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onSettingsChange({ ...projectSettings, imageStyle: style.id })}
                  className={`py-1.5 px-2.5 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col cursor-pointer ${
                    imageStyle === style.id
                      ? "bg-indigo-500/10 border-indigo-400 text-indigo-400 shadow-md shadow-indigo-500/5"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="font-sans font-bold text-[11px]">{style.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          id="btn-process-transcript"
          disabled={isProcessing || !transcript.trim()}
          className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 disabled:cursor-not-allowed font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-sky-500/20 flex items-center justify-center space-x-1.5 border border-sky-400/20"
        >
          {isProcessing ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5 animate-spin text-slate-950" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span>Generate Audio & Storyboard</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
