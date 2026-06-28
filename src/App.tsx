import React, { useState, useRef, useEffect } from "react";
import { TimelineNode, VoiceOption, IMAGE_STYLES, VOICES } from "./types";
import SidebarControls from "./components/SidebarControls";
import VideoCanvasPlayer from "./components/VideoCanvasPlayer";
import TimelineTrack from "./components/TimelineTrack";
import SegmentInspector from "./components/SegmentInspector";
import AddSegmentModal from "./components/AddSegmentModal";
import { getUnsplashUrl } from "./utils";
import { Sparkles, Film, Play, AlertTriangle, ShieldCheck, Heart, Info, MonitorPlay, Activity, Cpu, HardDrive, Video, Server, Lock, Unlock, Globe, Printer, MessageSquare, Music, Settings } from "lucide-react";

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
  const [timelineHeight, setTimelineHeight] = useState(215);
  const [hiddenTracks, setHiddenTracks] = useState<number[]>([]);

  // Studio and Project Preferences
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [autoplayPreviews, setAutoplayPreviews] = useState(true);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [autoScrollPlayhead, setAutoScrollPlayhead] = useState(true);
  const [defaultFrameDuration, setDefaultFrameDuration] = useState(4.0);
  const [rightSplitPercent, setRightSplitPercent] = useState(48);
  const [settingsActiveTab, setSettingsActiveTab] = useState<"project" | "studio">("project");
  const exportRef = useRef<{
    exportVideo?: () => void;
    exportStandalonePlayer?: () => void;
    exportPrintableStoryboard?: () => void;
    exportSrtSubtitles?: () => void;
    exportRawWavAudio?: () => void;
  } | null>(null);

  // Layout columns resizing states
  const [isDesktop, setIsDesktop] = useState(false);
  const [colWidths, setColWidths] = useState<[number, number, number]>([33.33, 41.67, 25.0]);
  const [locks, setLocks] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1280);
      setWindowHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleLock = (index: number) => {
    setLocks((prev) => {
      const newLocks = [...prev] as [boolean, boolean, boolean];
      newLocks[index] = !newLocks[index];
      return newLocks;
    });
  };

  const startDrag = (resizerIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const startX = e.clientX;
    const startWidths = [...colWidths] as [number, number, number];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      
      setColWidths((prevWidths) => {
        const newWidths = [...prevWidths] as [number, number, number];
        const minW = 15; // Minimum width percentage
        
        if (resizerIndex === 0) {
          if (locks[0] && locks[1]) return prevWidths;
          if (locks[0]) return prevWidths;
          
          let d = deltaPercent;
          let targetW1 = startWidths[0] + d;
          
          if (targetW1 < minW) {
            d = minW - startWidths[0];
            targetW1 = minW;
          } else if (targetW1 > 70) {
            d = 70 - startWidths[0];
            targetW1 = 70;
          }
          
          if (!locks[1]) {
            const targetW2 = startWidths[1] - d;
            if (targetW2 >= minW) {
              newWidths[0] = targetW1;
              newWidths[1] = targetW2;
            } else {
              const excess = minW - targetW2;
              if (!locks[2]) {
                const targetW3 = startWidths[2] - excess;
                if (targetW3 >= minW) {
                  newWidths[0] = targetW1;
                  newWidths[1] = minW;
                  newWidths[2] = targetW3;
                }
              }
            }
          } else if (!locks[2]) {
            const targetW3 = startWidths[2] - d;
            if (targetW3 >= minW) {
              newWidths[0] = targetW1;
              newWidths[2] = targetW3;
            }
          }
        } else {
          if (locks[1] && locks[2]) return prevWidths;
          if (locks[2]) return prevWidths;
          
          let d = deltaPercent;
          let targetW3 = startWidths[2] - d;
          
          if (targetW3 < minW) {
            d = startWidths[2] - minW;
            targetW3 = minW;
          } else if (targetW3 > 70) {
            d = startWidths[2] - 70;
            targetW3 = 70;
          }
          
          if (!locks[1]) {
            const targetW2 = startWidths[1] + d;
            if (targetW2 >= minW) {
              newWidths[2] = targetW3;
              newWidths[1] = targetW2;
            } else {
              const excess = minW - targetW2;
              if (!locks[0]) {
                const targetW1 = startWidths[0] - excess;
                if (targetW1 >= minW) {
                  newWidths[2] = targetW3;
                  newWidths[1] = minW;
                  newWidths[0] = targetW1;
                }
              }
            }
          } else if (!locks[0]) {
            const targetW1 = startWidths[0] + d;
            if (targetW1 >= minW) {
              newWidths[2] = targetW3;
              newWidths[0] = targetW1;
            }
          }
        }
        
        // Normalize
        const total = newWidths[0] + newWidths[1] + newWidths[2];
        if (Math.abs(total - 100) > 0.01) {
          if (!locks[2]) {
            newWidths[2] = 100 - newWidths[0] - newWidths[1];
          } else if (!locks[1]) {
            newWidths[1] = 100 - newWidths[0] - newWidths[2];
          } else if (!locks[0]) {
            newWidths[0] = 100 - newWidths[1] - newWidths[2];
          }
        }
        
        return newWidths;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [maxSplitPercent, setMaxSplitPercent] = useState(60); // 60% left (Timeline), 40% right (Preview)

  const startMaxSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPercent = maxSplitPercent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const pctDelta = (deltaX / window.innerWidth) * 100;
      const newPct = Math.max(25, Math.min(80, startPercent + pctDelta));
      setMaxSplitPercent(newPct);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const startRightSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = rightSplitPercent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const pctDelta = (deltaY / window.innerHeight) * 100;
      const newPct = Math.max(20, Math.min(80, startPercent + pctDelta));
      setRightSplitPercent(newPct);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const startTimelineResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      // Dragging upwards increases height: allow up to screen size minus offset
      const newHeight = Math.max(120, Math.min(window.innerHeight - 80, startHeight - deltaY));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Unified settings state which synchronizes with the SidebarControls panel
  const [projectSettings, setProjectSettings] = useState({
    transcript: "",
    voiceName: "Aoede",
    errorLevel: "Mild",
    imageStyle: "cinematic",
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

  // Move the boundary between two adjacent nodes (left resize of current node)
  const handleUpdateNodeBoundary = (nodeId: string, newStart: number) => {
    setTimeline((prev) => {
      const index = prev.findIndex((n) => n.id === nodeId);
      if (index === -1) return prev;
      
      const updated = [...prev];
      const currentNode = { ...updated[index] };
      
      // If there is a preceding node, adjust its boundary
      if (index > 0) {
        const prevNode = { ...updated[index - 1] };
        // Check if preceding node is locked
        if (prevNode.isLocked) return prev;
        
        // Ensure newStart is valid (at least 0.2s duration for both nodes)
        if (newStart - prevNode.start < 0.2 || currentNode.end - newStart < 0.2) {
          return prev;
        }
        
        prevNode.end = newStart;
        currentNode.start = newStart;
        
        updated[index - 1] = prevNode;
        updated[index] = currentNode;
      } else {
        // First node: changing its start can just change start, but usually start is 0
        return prev;
      }
      
      return updated;
    });

    // Keep active selected segment in perfect sync
    setSelectedNode((prev) => {
      if (!prev) return null;
      if (prev.id === nodeId) {
        const found = timeline.find((n) => n.id === nodeId);
        return found ? { ...prev, start: found.start } : prev;
      }
      return prev;
    });
  };

  const handleToggleTrackVisibility = (trackNum: number) => {
    setHiddenTracks((prev) =>
      prev.includes(trackNum)
        ? prev.filter((t) => t !== trackNum)
        : [...prev, trackNum]
    );
  };

  const handleSplitNode = (nodeId: string, splitTime: number) => {
    setTimeline((prev) => {
      const index = prev.findIndex((n) => n.id === nodeId);
      if (index === -1) return prev;

      const nodeToSplit = prev[index];
      if (splitTime <= nodeToSplit.start || splitTime >= nodeToSplit.end) return prev;

      const updated = [...prev];
      const part1 = {
        ...nodeToSplit,
        end: splitTime,
      };
      
      const newNodeId = `node_split_${Date.now()}`;
      const part2: TimelineNode = {
        ...nodeToSplit,
        id: newNodeId,
        start: splitTime,
      };

      updated[index] = part1;
      updated.splice(index + 1, 0, part2);
      
      // Select the second part
      setTimeout(() => setSelectedNode(part2), 50);

      return updated;
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
    const start = timeline.reduce((max, node) => Math.max(max, node.end), 0);
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

  const isMaximizedMode = timelineHeight > windowHeight / 2;

  return (
    <div className="h-screen max-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Main Navigation Header (Professional Video Editor Desk Bar) */}
      <header className="flex-none bg-slate-900 border-b border-slate-800/80 px-4 py-1.5 sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-2">
          {/* Logo Brand */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <div className="flex items-center justify-center shrink-0">
              <img
                src="/favicon.svg"
                className="w-8 h-8 animate-fade-in -scale-x-100 object-contain"
                alt="V.Gen Studio Logo"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white font-sans leading-tight">
                V.Gen Studio
              </h1>
              <p className="text-[9px] text-slate-400 font-sans">Storyboard & Subtitle Editor</p>
            </div>
          </div>

          {/* Right Controls Container */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto xl:justify-end">
            {/* Timecode & Monitor Readout Bar */}
            <div className="flex items-center space-x-4 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1 shadow-inner">
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
                  {(() => {
                    const maxEnd = timeline.reduce((max, node) => Math.max(max, node.end), 0);
                    return maxEnd > 0 ? (
                      <>
                        {Math.floor(maxEnd / 60).toString().padStart(2, "0")}:
                        {Math.floor(maxEnd % 60).toString().padStart(2, "0")}.
                        {Math.floor((maxEnd % 1) * 100).toString().padStart(2, "0")}
                      </>
                    ) : "00:00.00";
                  })()}
                </span>
              </div>
            </div>

            {/* Pro Export Header Actions */}
            <div className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-1 shadow-md shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono mr-1.5">Export</span>
              
              {/* 🎬 Video File */}
              <div className="relative group">
                <button
                  onClick={() => exportRef.current?.exportVideo?.()}
                  disabled={timeline.length === 0 || isExporting}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-indigo-400 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed hover:border-indigo-500/30 flex items-center justify-center"
                >
                  <Film className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none text-left">
                  <span className="block font-bold text-[10px] text-white">HD Video File (.MP4)</span>
                  <span className="block text-[8px] text-slate-400 mt-0.5 leading-normal">
                    Compile the visual storyboard and voice track into a high-fidelity MP4 video file on the server.
                  </span>
                </div>
              </div>

              {/* 🌐 HTML5 Standalone Player */}
              <div className="relative group">
                <button
                  onClick={() => exportRef.current?.exportStandalonePlayer?.()}
                  disabled={!audioBase64 || timeline.length === 0 || isExporting}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-sky-400 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed hover:border-sky-500/30 flex items-center justify-center"
                >
                  <Globe className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none text-left">
                  <span className="block font-bold text-[10px] text-white">Interactive Player (.HTML)</span>
                  <span className="block text-[8px] text-slate-400 mt-0.5 leading-normal">
                    Download a self-contained, offline-playable interactive player with uncompressed quality.
                  </span>
                </div>
              </div>

              {/* 📄 Print Guide / PDF */}
              <div className="relative group">
                <button
                  onClick={() => exportRef.current?.exportPrintableStoryboard?.()}
                  disabled={timeline.length === 0 || isExporting}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-amber-400 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed hover:border-amber-500/30 flex items-center justify-center"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none text-left">
                  <span className="block font-bold text-[10px] text-white">Printable Storyboard (PDF)</span>
                  <span className="block text-[8px] text-slate-400 mt-0.5 leading-normal">
                    Open a print-ready guidebook detailing all scenes, narration, and AI prompts.
                  </span>
                </div>
              </div>

              {/* 💬 SRT Subtitles */}
              <div className="relative group">
                <button
                  onClick={() => exportRef.current?.exportSrtSubtitles?.()}
                  disabled={timeline.length === 0 || isExporting}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-emerald-400 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed hover:border-emerald-500/30 flex items-center justify-center"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none text-left">
                  <span className="block font-bold text-[10px] text-white">Subtitles (.SRT)</span>
                  <span className="block text-[8px] text-slate-400 mt-0.5 leading-normal">
                    Download standard SRT subtitles for Premiere, DaVinci, or CapCut editors.
                  </span>
                </div>
              </div>

              {/* 🎵 WAV Audio */}
              <div className="relative group">
                <button
                  onClick={() => exportRef.current?.exportRawWavAudio?.()}
                  disabled={!audioUrl || isExporting}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-pink-400 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed hover:border-pink-500/30 flex items-center justify-center"
                >
                  <Music className="w-3.5 h-3.5" />
                </button>
                {/* Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-none text-left">
                  <span className="block font-bold text-[10px] text-white">Voice Track (.WAV)</span>
                  <span className="block text-[8px] text-slate-400 mt-0.5 leading-normal">
                    Download the pristine master voice track directly.
                  </span>
                </div>
              </div>
            </div>

            {/* ⚙️ Studio Settings Gear Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer shrink-0"
              title="Studio Settings & Project Preferences"
            >
              <Settings className="w-4 h-4 animate-hover-spin" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 min-h-0 w-full max-w-[1920px] px-3 xl:px-4 py-1.5 space-y-1.5 mx-auto flex flex-col justify-between overflow-hidden">
        
        {/* Error notification banner */}
        {errorMessage && (
          <div className="flex-none bg-red-950/40 border border-red-900/50 p-2 rounded-xl text-xs text-red-200 flex items-start space-x-2 animate-fade-in shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">System Warning:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Workspace Layout Grid */}
        {isMaximizedMode ? (
          <div className="flex-1 min-h-0 flex flex-row items-stretch overflow-hidden gap-3 w-full animate-fade-in">
            {/* LEFT HALF: Timeline Track */}
            <div 
              style={{ width: `${maxSplitPercent}%` }}
              className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
            >
              <div className="flex-none text-xs font-bold text-slate-300 px-2.5 py-1 bg-slate-950/55 rounded-t-lg border-b border-slate-800 flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-indigo-400">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Timeline Editor (Maximized Studio Workspace)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500 font-sans hidden md:inline">Drag vertical bar to resize split</span>
                  <button
                    type="button"
                    onClick={() => setTimelineHeight(240)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold transition-all border border-indigo-500/30 cursor-pointer shadow-sm shadow-indigo-600/10"
                    title="Restore standard layout"
                  >
                    Restore Layout
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
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
                  onUpdateNodeDuration={handleUpdateNodeDuration}
                  onUpdateNodeBoundary={handleUpdateNodeBoundary}
                  hiddenTracks={hiddenTracks}
                  onToggleTrackVisibility={handleToggleTrackVisibility}
                  onSplitNode={handleSplitNode}
                />
              </div>
            </div>

            {/* Split Resize Drag Bar */}
            <div 
              onMouseDown={startMaxSplitResize}
              className="group w-2 hover:w-2 bg-transparent hover:bg-indigo-500/10 active:bg-indigo-500/20 cursor-col-resize transition-all h-full flex items-center justify-center relative select-none z-20 shrink-0"
              title="Drag to resize split panels"
            >
              <div className="w-[2px] h-12 rounded bg-slate-800/80 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors"></div>
            </div>

            {/* RIGHT HALF: Video Preview & Segment Inspector (with vertical split resizing) */}
            <div 
              style={{ width: `${100 - maxSplitPercent}%` }}
              className="flex flex-col min-h-0 h-full overflow-hidden shrink-0 gap-2"
            >
              {/* TOP: Video Preview */}
              <div 
                style={{ height: `${rightSplitPercent}%` }}
                className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-0.5 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
              >
                <div className="flex-none text-[10px] font-bold text-slate-400 px-2.5 py-1 bg-slate-950/55 rounded-t-lg border-b border-slate-800/50 flex items-center justify-between select-none">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-400 font-bold">Video Preview Monitor</span>
                  <span className="text-[8px] text-slate-500 font-sans">Drag separator to adjust height</span>
                </div>
                <div className="p-1 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
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
                    hiddenTracks={hiddenTracks}
                    exportRef={exportRef}
                    showGridOverlay={showGridOverlay}
                  />
                </div>
              </div>

              {/* Adjustable split drag bar between Preview and Inspector */}
              <div 
                onMouseDown={startRightSplitResize}
                className="group h-1.5 hover:h-1.5 bg-transparent hover:bg-indigo-500/10 active:bg-indigo-500/20 cursor-row-resize transition-all flex items-center justify-center relative select-none z-20 shrink-0"
                title="Drag vertically to adjust Preview / Inspector split"
              >
                <div className="h-[2px] w-16 rounded bg-slate-800 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors"></div>
              </div>

              {/* BOTTOM: Segment Inspector (placed below preview) */}
              <div 
                style={{ height: `calc(${100 - rightSplitPercent}% - 6px)` }}
                className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-0.5 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
              >
                <div className="p-1 flex-1 overflow-y-auto custom-scrollbar">
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
          </div>
        ) : (
          <>
            <div 
              ref={containerRef}
              className={`flex-1 min-h-0 flex ${isDesktop ? "flex-row" : "flex-col gap-3.5"} items-stretch overflow-hidden`}
            >
              {/* Left Panel: Transcript */}
              <div 
                style={isDesktop ? { width: `${colWidths[0]}%` } : undefined}
                className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
              >
                <div className="flex-none text-xs font-bold text-slate-300 px-2.5 py-1 bg-slate-950/55 rounded-t-lg border-b border-slate-800 flex items-center justify-between">
                  <span>Source Transcript</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(0)}
                    className={`p-1 rounded hover:bg-slate-800/50 transition-colors cursor-pointer ${locks[0] ? "text-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                    title={locks[0] ? "Unlock panel width" : "Lock panel width"}
                  >
                    {locks[0] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex-1 p-1 overflow-y-auto custom-scrollbar">
                  <SidebarControls
                    onGenerate={handleGenerateProject}
                    isProcessing={isProcessing}
                    projectSettings={projectSettings}
                    onSettingsChange={setProjectSettings}
                    onReset={handleResetProject}
                    hasSavedProject={timeline.length > 0 || !!audioUrl || projectSettings.transcript.trim().length > 0}
                  />
                </div>
              </div>

              {isDesktop && (
                <div 
                  onMouseDown={startDrag(0)}
                  className="group w-2 hover:w-2 bg-transparent hover:bg-indigo-500/10 active:bg-indigo-500/20 cursor-col-resize transition-all h-full flex items-center justify-center relative select-none z-20 shrink-0"
                  title="Drag to resize panels"
                >
                  <div className="w-[2px] h-10 rounded bg-slate-800/50 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors"></div>
                </div>
              )}

              {/* Center Panel: Video Preview */}
              <div 
                style={isDesktop ? { width: `${colWidths[1]}%` } : undefined}
                className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
              >
                <div className="flex-none text-xs font-bold text-slate-300 px-2.5 py-1 bg-slate-950/55 rounded-t-lg border-b border-slate-800 flex items-center justify-between">
                  <span>Video Preview</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(1)}
                    className={`p-1 rounded hover:bg-slate-800/50 transition-colors cursor-pointer ${locks[1] ? "text-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                    title={locks[1] ? "Unlock panel width" : "Lock panel width"}
                  >
                    {locks[1] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-1 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
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
                    hiddenTracks={hiddenTracks}
                    exportRef={exportRef}
                  />
                </div>
              </div>

              {isDesktop && (
                <div 
                  onMouseDown={startDrag(1)}
                  className="group w-2 hover:w-2 bg-transparent hover:bg-indigo-500/10 active:bg-indigo-500/20 cursor-col-resize transition-all h-full flex items-center justify-center relative select-none z-20 shrink-0"
                  title="Drag to resize panels"
                >
                  <div className="w-[2px] h-10 rounded bg-slate-800/50 group-hover:bg-indigo-400 group-active:bg-indigo-500 transition-colors"></div>
                </div>
              )}

              {/* Right Panel: Segment Inspector */}
              <div 
                style={isDesktop ? { width: `${colWidths[2]}%` } : undefined}
                className="flex flex-col min-h-0 bg-slate-900/40 rounded-xl p-1 border border-slate-800/60 shadow-xl overflow-hidden shrink-0"
              >
                <div className="flex-none text-xs font-bold text-slate-300 px-2.5 py-1 bg-slate-950/55 rounded-t-lg border-b border-slate-800 flex items-center justify-between">
                  <span>Segment Inspector</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(2)}
                    className={`p-1 rounded hover:bg-slate-800/50 transition-colors cursor-pointer ${locks[2] ? "text-amber-400" : "text-slate-500 hover:text-slate-300"}`}
                    title={locks[2] ? "Unlock panel width" : "Lock panel width"}
                  >
                    {locks[2] ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-1 flex-1 overflow-y-auto custom-scrollbar">
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
            <div className="flex flex-col flex-none w-full shrink-0" style={{ height: `${timelineHeight}px` }}>
              {/* Timeline height adjustment handle */}
              <div
                onMouseDown={startTimelineResize}
                className="h-1.5 hover:h-1.5 bg-slate-900 border-t border-b border-slate-800/80 hover:bg-sky-500/25 active:bg-sky-500/45 cursor-row-resize transition-all flex items-center justify-center select-none relative z-20 rounded-t"
                title="Drag to resize Timeline track"
              >
                <div className="h-[2px] w-12 rounded bg-slate-800 hover:bg-sky-400 active:bg-sky-500 transition-colors"></div>
              </div>
              <div className="flex-1 min-h-0">
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
                  onUpdateNodeDuration={handleUpdateNodeDuration}
                  onUpdateNodeBoundary={handleUpdateNodeBoundary}
                  hiddenTracks={hiddenTracks}
                  onToggleTrackVisibility={handleToggleTrackVisibility}
                  onSplitNode={handleSplitNode}
                />
              </div>
            </div>
          </>
        )}

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
            if (loopPlayback && audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => setIsPlaying(false));
            } else {
              setIsPlaying(false);
            }
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

      {/* ⚙️ Studio Settings Modal Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-indigo-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">Studio & Project Preferences</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Control NLE viewport, timeline rules & AI generation</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-700/60 transition-all text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Modal Tabs Selector */}
            <div className="flex bg-slate-950/50 border-b border-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => setSettingsActiveTab("project")}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  settingsActiveTab === "project"
                    ? "bg-slate-800 text-indigo-400 shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                Project Settings
              </button>
              <button
                type="button"
                onClick={() => setSettingsActiveTab("studio")}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  settingsActiveTab === "studio"
                    ? "bg-slate-800 text-indigo-400 shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                Studio Preferences
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1 text-left">
              {settingsActiveTab === "project" ? (
                <>
                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      Video Screen Format (Aspect Ratio)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                            aspectRatio === ratio
                              ? "bg-indigo-500/10 border-indigo-400 text-indigo-400"
                              : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {ratio === "16:9" ? "16:9 Landscape" : ratio === "9:16" ? "9:16 Vertical" : "1:1 Square"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Art Style */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      Default Art Style for Scene Generation
                    </label>
                    <select
                      value={projectSettings.imageStyle}
                      onChange={(e) => setProjectSettings({ ...projectSettings, imageStyle: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {IMAGE_STYLES.map((style) => (
                        <option key={style.id} value={style.id} className="bg-slate-900">
                          {style.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Narration Voice */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      Text-to-Speech (TTS) Narrator Speaker
                    </label>
                    <select
                      value={projectSettings.voiceName}
                      onChange={(e) => setProjectSettings({ ...projectSettings, voiceName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {VOICES.map((voice) => (
                        <option key={voice.id} value={voice.id} className="bg-slate-900">
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speech Speed */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        TTS Narration Playback Speed
                      </label>
                      <span className="text-xs font-bold font-mono text-indigo-400">
                        {projectSettings.speechSpeed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={projectSettings.speechSpeed}
                      onChange={(e) => setProjectSettings({ ...projectSettings, speechSpeed: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Grid Overlay */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/45 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Rule of Thirds Grid Overlay</h4>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Show professional camera grid guidelines in Video Preview</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGridOverlay}
                        onChange={(e) => setShowGridOverlay(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {/* Autoplay Previews */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/45 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Autoplay generated previews</h4>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Automatically play narrative after generating speech tracks</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoplayPreviews}
                        onChange={(e) => setAutoplayPreviews(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {/* Loop playback */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/45 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Continuous loop playback</h4>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Loop voice speech audio track continuously when playback ends</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loopPlayback}
                        onChange={(e) => setLoopPlayback(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {/* Playhead Auto Follow */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/45 rounded-xl border border-slate-800/80">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Playhead Auto-Scroll Follow</h4>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Scroll timeline to follow active playhead time indicator during playback</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScrollPlayhead}
                        onChange={(e) => setAutoScrollPlayhead(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {/* Default Frame Duration */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      Default Manual Frame Insert Duration (seconds)
                    </label>
                    <select
                      value={defaultFrameDuration}
                      onChange={(e) => setDefaultFrameDuration(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="2.0">2.0 seconds</option>
                      <option value="3.0">3.0 seconds</option>
                      <option value="4.0">4.0 seconds (Default)</option>
                      <option value="5.5">5.5 seconds</option>
                      <option value="8.0">8.0 seconds</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Footer buttons */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
