import { useState, useRef, useEffect } from "react";
import { TimelineNode, VoiceOption, IMAGE_STYLES, VOICES } from "./types";
import SidebarControls from "./components/SidebarControls";
import VideoCanvasPlayer from "./components/VideoCanvasPlayer";
import TimelineTrack from "./components/TimelineTrack";
import SegmentInspector from "./components/SegmentInspector";
import AddSegmentModal from "./components/AddSegmentModal";
import { getUnsplashUrl } from "./utils";
import { Sparkles, Film, Play, AlertTriangle, ShieldCheck, Heart, Info, MonitorPlay, Activity, Cpu, HardDrive, Video, Server } from "lucide-react";

export default function App() {
  const [timeline, setTimeline] = useState<TimelineNode[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isKeyConfigured, setIsKeyConfigured] = useState(true);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Unified settings state which synchronizes with the SidebarControls panel
  const [projectSettings, setProjectSettings] = useState({
    transcript: "Today is my five thousandth day of operational service. I was built to catalog cosmic radiation. But sometimes, when the stars align, I find myself simply staring at the colorful nebulas, wondering if they can feel the warmth of the suns that birthed them.",
    voiceName: "Aoede",
    errorLevel: "Mild",
    imageStyle: "Cinematic",
    speechSpeed: 1.0,
  });

  // Sync speechSpeed state with projectSettings
  useEffect(() => {
    setSpeechSpeed(projectSettings.speechSpeed);
  }, [projectSettings.speechSpeed]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize playback speed of audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speechSpeed;
    }
  }, [speechSpeed, audioUrl, isPlaying]);

  // Convert Base64 speech stream to a playable Blob URL
  const decodeBase64ToBlobUrl = (base64Data: string, contentType = "audio/wav"): string => {
    const sliceSize = 1024;
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return URL.createObjectURL(blob);
  };

  // Initial project setup - loads from LocalStorage
  useEffect(() => {
    try {
      const savedStateStr = localStorage.getItem("fableforge_project_state");
      if (savedStateStr) {
        const parsed = JSON.parse(savedStateStr);
        if (parsed.timeline) {
          setTimeline(parsed.timeline);
        }
        if (parsed.projectSettings) {
          setProjectSettings(parsed.projectSettings);
          if (parsed.projectSettings.speechSpeed) {
            setSpeechSpeed(parsed.projectSettings.speechSpeed);
          }
        }
        if (parsed.audioBase64) {
          setAudioBase64(parsed.audioBase64);
          const newUrl = decodeBase64ToBlobUrl(parsed.audioBase64);
          setAudioUrl(newUrl);
        }
        if (parsed.aspectRatio) {
          setAspectRatio(parsed.aspectRatio);
        }
        if (parsed.selectedNodeId && parsed.timeline) {
          const found = parsed.timeline.find((n: any) => n.id === parsed.selectedNodeId);
          if (found) {
            setSelectedNode(found);
          } else if (parsed.timeline.length > 0) {
            setSelectedNode(parsed.timeline[0]);
          }
        } else if (parsed.timeline && parsed.timeline.length > 0) {
          setSelectedNode(parsed.timeline[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load saved state from localStorage:", err);
    }
  }, []);

  // Auto-save project state to LocalStorage
  useEffect(() => {
    if (timeline.length > 0 || audioBase64 || projectSettings.transcript) {
      const stateToSave = {
        timeline,
        audioBase64,
        projectSettings,
        selectedNodeId: selectedNode?.id || null,
        aspectRatio
      };
      localStorage.setItem("fableforge_project_state", JSON.stringify(stateToSave));
    }
  }, [timeline, audioBase64, projectSettings, selectedNode, aspectRatio]);

  // Clears active state and resets project
  const handleResetProject = () => {
    if (window.confirm("Are you sure you want to start a fresh project? This will clear all timeline segments and generated audio.")) {
      localStorage.removeItem("fableforge_project_state");
      setTimeline([]);
      setAudioUrl(null);
      setAudioBase64(null);
      setCurrentTime(0);
      setIsPlaying(false);
      setSelectedNode(null);
      setProjectSettings({
        transcript: "",
        voiceName: "Aoede",
        errorLevel: "Mild",
        imageStyle: "Cinematic",
        speechSpeed: 1.0,
      });
      setSpeechSpeed(1.0);
      setErrorMessage(null);
    }
  };

  // Generate complete story & humanized voice track from raw transcript
  const handleGenerateProject = async (params: {
    transcript: string;
    voiceName: string;
    errorLevel: string;
    imageStyle: string;
    speechSpeed: number;
  }) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setIsPlaying(false);
    setSpeechSpeed(params.speechSpeed);

    try {
      // Step 1: Process transcript into segmented timing storyboard
      const processRes = await fetch("/api/process-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: params.transcript,
          errorLevel: params.errorLevel,
          imageStyle: params.imageStyle
        })
      });

      if (!processRes.ok) {
        const errData = await processRes.json();
        throw new Error(errData.error || "Failed to process transcript storyboard metadata.");
      }

      const storyData = await processRes.json();
      
      if (!storyData.timeline || storyData.timeline.length === 0) {
        throw new Error("No storyboard timeline generated by Gemini.");
      }

      // Step 2: Fetch corresponding speech audio based on the new humanized script
      const ttsRes = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: storyData.speechScript,
          voiceName: params.voiceName
        })
      });

      if (!ttsRes.ok) {
        const errData = await ttsRes.json();
        throw new Error(errData.error || "Failed to synthesize speech voiceover.");
      }

      const audioResult = await ttsRes.json();
      const newAudioUrl = decodeBase64ToBlobUrl(audioResult.audioData);
      setAudioBase64(audioResult.audioData);

      // Handle custom warnings or fallback notifications to the user
      if (storyData.isOfflineFallback && audioResult.isFallback) {
        setErrorMessage("Notice: Both language and voice models are experiencing temporary high demand. We have generated an instant offline storyboard and timing track so you can continue editing and exporting without interruption!");
        setTimeout(() => setErrorMessage(null), 12000);
      } else if (storyData.isOfflineFallback) {
        setErrorMessage("Notice: Gemini model is experiencing high demand. Storyboard segments and timing prompts were dynamically structured offline so you can continue editing smoothly!");
        setTimeout(() => setErrorMessage(null), 10000);
      } else if (audioResult.isFallback) {
        setErrorMessage("Notice: Gemini vocal synthesis is temporarily experiencing high demand. A beautifully synchronized silent timeline has been generated so you can scrub, edit, and export your video beautifully!");
        setTimeout(() => setErrorMessage(null), 10000);
      }

      // Step 3: Populate timeline blocks instantly with beautiful high-quality fallback visuals
      // This is near-instant, reliable, and completely quota-friendly!
      const resolvedTimeline: TimelineNode[] = storyData.timeline.map((node: any, idx: number) => {
        const nodeId = `node_${Date.now()}_${idx}`;
        return {
          id: nodeId,
          start: node.start,
          end: node.end,
          text: node.text,
          prompt: node.prompt,
          searchQuery: node.searchQuery,
          imageUrl: getUnsplashUrl(node.searchQuery || "scenic abstract art", nodeId),
          isAiGenerated: false,
          isGenerating: false
        };
      });

      setTimeline(resolvedTimeline);
      setAudioUrl(newAudioUrl);
      setCurrentTime(0);
      setSelectedNode(resolvedTimeline[0]);

    } catch (err: any) {
      console.error("Storyboard compilation failed:", err);
      
      // Let user know if API Key is missing and offer a friendly message
      if (err.message?.includes("GEMINI_API_KEY")) {
        setIsKeyConfigured(false);
        setErrorMessage("Gemini API Key is missing. Please open the Secrets panel in AI Studio and add GEMINI_API_KEY to start using custom AI voice synthesis!");
      } else {
        setErrorMessage(err.message || "An unexpected error occurred during storyboarding. Please check connectivity and try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate AI visual images for ALL blocks sequentially
  const handleGenerateAllImages = async () => {
    if (timeline.length === 0) return;
    setIsGeneratingAll(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < timeline.length; i++) {
        const node = timeline[i];
        
        // Mark as generating
        setTimeline((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, isGenerating: true } : n))
        );
        setSelectedNode((prev) => prev && prev.id === node.id ? { ...prev, isGenerating: true } : prev);

        try {
          const res = await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: node.prompt, searchQuery: node.searchQuery })
          });

          if (!res.ok) {
            throw new Error(`Failed to generate image for segment ${i + 1}`);
          }

          const imgResult = await res.json();
          let finalImageUrl = imgResult.imageData;

          if (imgResult.isFallback || !finalImageUrl) {
            finalImageUrl = getUnsplashUrl(node.searchQuery || "scenic abstract art", node.id + "_" + Date.now());
            setErrorMessage("Notice: Quota limit reached for AI generation. Standard stock visual was kept for this slot.");
            setTimeout(() => setErrorMessage(null), 8000);
          }

          setTimeline((prev) =>
            prev.map((n) =>
              n.id === node.id ? { ...n, imageUrl: finalImageUrl || n.imageUrl, isGenerating: false, isAiGenerated: !imgResult.isFallback } : n
            )
          );

          setSelectedNode((prev) => {
            if (prev && prev.id === node.id) {
              return { ...prev, imageUrl: finalImageUrl || prev.imageUrl, isGenerating: false, isAiGenerated: !imgResult.isFallback };
            }
            return prev;
          });

        } catch (err: any) {
          console.warn(`Error on image generation for segment ${i + 1}:`, err);
          setTimeline((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, isGenerating: false } : n))
          );
          setSelectedNode((prev) => prev && prev.id === node.id ? { ...prev, isGenerating: false } : prev);
        }
      }
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Generate an individual AI visual image using Gemini for a single block
  const handleGenerateAIImage = async (nodeId: string) => {
    // Locate the active block
    const node = timeline.find((n) => n.id === nodeId);
    if (!node) return;

    // Set generating status
    setTimeline((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, isGenerating: true } : n))
    );

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: node.prompt, searchQuery: node.searchQuery })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate AI visual.");
      }

      const imgResult = await res.json();
      
      let finalImageUrl = imgResult.imageData;
      if (imgResult.isFallback || !finalImageUrl) {
        // Fallback to high quality photography via Unsplash
        finalImageUrl = getUnsplashUrl(node.searchQuery || "scenic abstract art", node.id + "_" + Date.now());
        setErrorMessage("Notice: Your Gemini Image API quota was temporarily exceeded. A beautiful, high-clarity stock visual has been dynamically aligned as an automatic fallback!");
        setTimeout(() => setErrorMessage(null), 8000);
      }

      // Swap out visual image url with the generated base64 or Unsplash fallback string
      setTimeline((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, imageUrl: finalImageUrl, isGenerating: false } : n
        )
      );

      // Sync active selected state
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => prev ? { ...prev, imageUrl: finalImageUrl } : null);
      }

    } catch (err: any) {
      console.error("AI image generation failed:", err);
      alert(err.message || "Could not generate AI image. Checked if API key is valid.");
      setTimeline((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, isGenerating: false } : n))
      );
    }
  };

  // Custom visual or timing node update dispatcher
  const handleUpdateNode = (nodeId: string, updated: Partial<TimelineNode>) => {
    setTimeline((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updated } : n))
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, ...updated } : null);
    }
  };

  // Shift subsequent timeline nodes cleanly when segment duration is resized
  const handleUpdateNodeDuration = (nodeId: string, newDuration: number) => {
    if (newDuration <= 0.1) return;
    setTimeline((prev) => {
      const index = prev.findIndex((n) => n.id === nodeId);
      if (index === -1) return prev;
      
      const updated = [...prev];
      const node = { ...updated[index] };
      const oldDuration = node.end - node.start;
      const diff = newDuration - oldDuration;
      
      node.end = node.start + newDuration;
      updated[index] = node;
      
      // Shift downstream elements
      for (let i = index + 1; i < updated.length; i++) {
        updated[i] = {
          ...updated[i],
          start: updated[i].start + diff,
          end: updated[i].end + diff
        };
      }
      
      return updated;
    });

    // Keep active selected segment in perfect sync
    setSelectedNode((prev) => {
      if (prev && prev.id === nodeId) {
        return { ...prev, end: prev.start + newDuration };
      }
      return prev;
    });
  };

  // Delete node and re-align timings cleanly
  const handleDeleteNode = (nodeId: string) => {
    const filtered = timeline.filter((n) => n.id !== nodeId);
    
    // Smoothly stitch together remaining chunks so timeline has no empty gaps
    let currentTotal = 0;
    const stitched = filtered.map((node) => {
      const dur = node.end - node.start;
      const reAligned = {
        ...node,
        start: currentTotal,
        end: currentTotal + dur
      };
      currentTotal += dur;
      return reAligned;
    });

    setTimeline(stitched);
    if (selectedNode?.id === nodeId) {
      setSelectedNode(stitched[0] || null);
    }
  };

  // Trigger opening of the customized Clip insert dialog
  const handleAddNode = () => {
    setIsAddModalOpen(true);
  };

  const handleInsertCustomNode = (data: {
    text: string;
    prompt: string;
    searchQuery: string;
    duration: number;
  }) => {
    const lastNode = timeline[timeline.length - 1];
    const start = lastNode ? lastNode.end : 0;
    const end = start + data.duration;
    const newNodeId = `node_${Date.now()}`;

    const newNode: TimelineNode = {
      id: newNodeId,
      start,
      end,
      text: data.text,
      prompt: data.prompt,
      searchQuery: data.searchQuery,
      imageUrl: getUnsplashUrl(data.searchQuery || "scenic abstract art", newNodeId)
    };

    setTimeline([...timeline, newNode]);
    setSelectedNode(newNode);
  };

  return (
    <div className="h-screen max-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Main Navigation Header (Professional Video Editor Desk Bar) */}
      <header className="flex-none bg-slate-900 border-b border-slate-800/80 px-6 py-2 sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Logo Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 shadow-md">
              <Film className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-sans">
                V.Gen Studio
              </h1>
              <p className="text-[10px] text-slate-400 font-sans">Storyboard & Subtitle Editor</p>
            </div>
          </div>

          {/* Timecode & Monitor Readout Bar */}
          <div className="flex items-center space-x-6 bg-slate-950 border border-slate-800 rounded-xl px-5 py-1.5 shadow-inner">
            {/* Playhead Status Indicator */}
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-emerald-500" : "bg-slate-500"}`}></span>
              <span className="text-xs font-medium text-slate-300">
                {isPlaying ? "Playing" : "Paused"}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800"></div>

            {/* Current Cursor Timecode */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-medium text-slate-500">Time:</span>
              <span className="text-xs font-bold font-mono text-sky-400">
                {Math.floor(currentTime / 60).toString().padStart(2, "0")}:
                {Math.floor(currentTime % 60).toString().padStart(2, "0")}.
                {Math.floor((currentTime % 1) * 100).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800"></div>

            {/* Active Sequence Length */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-medium text-slate-500">Duration:</span>
              <span className="text-xs font-bold font-mono text-slate-300">
                {timeline.length > 0 ? (
                  <>
                    {Math.floor(timeline[timeline.length - 1].end / 60).toString().padStart(2, "0")}:
                    {Math.floor(timeline[timeline.length - 1].end % 60).toString().padStart(2, "0")}.
                    {Math.floor((timeline[timeline.length - 1].end % 1) * 100).toString().padStart(2, "0")}
                  </>
                ) : "00:00.00"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 min-h-0 w-full max-w-[1920px] px-4 xl:px-6 py-2.5 space-y-2.5 mx-auto flex flex-col justify-between overflow-hidden">
        
        {/* Error notification banner */}
        {errorMessage && (
          <div className="flex-none bg-red-950/40 border border-red-900/50 p-2.5 rounded-xl text-xs text-red-200 flex items-start space-x-2 animate-fade-in shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">System Warning:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Workspace Layout Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
          
          {/* Left Panel: Transcript (col-span-4) */}
          <div className="xl:col-span-4 flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden">
            <div className="flex-none text-xs font-bold text-slate-300 px-3 py-1.5 bg-slate-950/55 rounded-t-lg border-b border-slate-800">
              Source Transcript
            </div>
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
              <SidebarControls
                onGenerate={handleGenerateProject}
                isProcessing={isProcessing}
                projectSettings={projectSettings}
                onSettingsChange={setProjectSettings}
                onReset={handleResetProject}
                hasSavedProject={timeline.length > 0 || !!audioUrl}
              />
            </div>
          </div>

          {/* Center Panel: Video Preview (col-span-5) */}
          <div className="xl:col-span-5 flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden">
            <div className="flex-none text-xs font-bold text-slate-300 px-3 py-1.5 bg-slate-950/55 rounded-t-lg border-b border-slate-800">
              Video Preview
            </div>
            <div className="p-2 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
              <VideoCanvasPlayer
                timeline={timeline}
                audioUrl={audioUrl}
                audioBase64={audioBase64}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                isExporting={isExporting}
                setIsExporting={setIsExporting}
                audioRef={audioRef}
                aspectRatio={aspectRatio}
                setAspectRatio={setAspectRatio}
              />
            </div>
          </div>

          {/* Right Panel: Segment Inspector (col-span-3) */}
          <div className="xl:col-span-3 flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden">
            <div className="flex-none text-xs font-bold text-slate-300 px-3 py-1.5 bg-slate-950/55 rounded-t-lg border-b border-slate-800">
              Segment Inspector
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
              <SegmentInspector
                node={selectedNode}
                onUpdateNode={handleUpdateNode}
                onUpdateNodeDuration={handleUpdateNodeDuration}
                onDeleteNode={handleDeleteNode}
                onGenerateAIImage={handleGenerateAIImage}
                isGeneratingAll={isGeneratingAll}
              />
            </div>
          </div>
        </div>

        {/* Action ribbon - Step 2: Render AI visuals */}
        {timeline.length > 0 && (
          <div className="flex-none bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/10 border border-slate-800/60 rounded-xl px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-200">
                  AI Illustration Generator
                </h3>
                <p className="text-[10px] text-slate-500 font-sans">
                  Batch render customized Imagen AI illustrations for all storyboard frames.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateAllImages}
              disabled={isGeneratingAll || isProcessing}
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all shadow-md hover:shadow-indigo-500/10 flex items-center space-x-2 shrink-0 border border-indigo-400/20 cursor-pointer"
            >
              {isGeneratingAll ? (
                <>
                  <span className="animate-spin h-3 w-3 border-2 border-slate-950 border-t-transparent rounded-full" />
                  <span>COMPILING AI FRAMES {timeline.filter(n => n.isAiGenerated).length}/{timeline.length} ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                  <span>Render All AI Frames</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Bottom Panel: MULTI-TRACK SEQUENCE TIMELINE */}
        <div className="flex-none h-[180px] bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl w-full flex flex-col overflow-hidden">
          <div className="flex-none text-xs font-bold text-slate-300 px-3 py-1.5 bg-slate-950/55 rounded-t-lg border-b border-slate-800">
            Sequence Timeline & Captions
          </div>
          <div className="flex-1 p-2 min-h-0 overflow-hidden">
            <TimelineTrack
              timeline={timeline}
              currentTime={currentTime}
              onSelectNode={setSelectedNode}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onAddNode={handleAddNode}
              onGenerateAIImage={handleGenerateAIImage}
              selectedNode={selectedNode}
              onSeekTo={(sec) => {
                setCurrentTime(sec);
                if (audioRef.current) audioRef.current.currentTime = sec;
              }}
            />
          </div>
        </div>

      </main>

      {/* Hidden audio element for speech playback sync */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={(e) => {
            if (!isExporting) {
              setCurrentTime(e.currentTarget.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
          }}
          className="hidden"
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900/60 py-2.5 px-6 text-center text-[10px] text-slate-500 font-sans tracking-wide">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 V.Gen Studio. All rights reserved.</p>
          <p className="text-slate-600">Powered by Gemini & Imagen</p>
        </div>
      </footer>

      {/* Manual Clip Customization Add Modal overlay */}
      <AddSegmentModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleInsertCustomNode}
      />
    </div>
  );
}
