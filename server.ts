import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy-loaded Gemini client to prevent startup crashes when API key is missing
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to convert 16-bit PCM buffer to a WAV buffer with a proper 44-byte header
function addWavHeader(pcmBuffer: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  // "RIFF"
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  // "WAVE"
  header.write("WAVE", 8);
  // "fmt "
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // numChannels
  header.writeUInt32LE(sampleRate, 24); // sampleRate
  header.writeUInt32LE(byteRate, 28); // byteRate
  header.writeUInt16LE(blockAlign, 32); // blockAlign
  header.writeUInt16LE(bitsPerSample, 34); // bitsPerSample
  // "data"
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Robust dynamic offline script segmenter when Gemini is rate-limited or offline
function offlineProcessTranscript(transcript: string, errorLevel: string, imageStyle: string) {
  const sentences = transcript.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const segments: any[] = [];
  let currentTime = 0;
  const fullSpeechScriptParts: string[] = [];

  const fillersMild = ["uh...", "um...", "y'know,", "well,"];
  const fillersHigh = ["uh...", "um...", "like...", "y'know,", "wait, no,", "so, basically,"];

  sentences.forEach((sentence, idx) => {
    const words = sentence.trim().split(/\s+/).filter(w => w.length > 0);
    const chunkSize = 14;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      let segmentText = chunk.join(" ");

      // Inject speech errors based on errorLevel
      if (errorLevel === "Mild" && idx % 2 === 0 && i === 0) {
        const filler = fillersMild[idx % fillersMild.length];
        segmentText = filler + " " + segmentText;
      } else if (errorLevel === "High") {
        const filler1 = fillersHigh[(idx + i) % fillersHigh.length];
        const filler2 = fillersHigh[(idx + i + 1) % fillersHigh.length];
        segmentText = filler1 + " " + segmentText.replace(/,\s*/g, `, ${filler2} `);
        if (chunk.length > 3 && i === 0) {
          const firstWord = chunk[0];
          if (firstWord.length > 1) {
            segmentText = firstWord.substring(0, 1) + "-" + firstWord + "... " + segmentText;
          }
        }
      }

      const wordCount = segmentText.split(/\s+/).length;
      const duration = Math.max(3.5, Math.min(7.0, wordCount / 2.3)); 
      const start = parseFloat(currentTime.toFixed(1));
      const end = parseFloat((currentTime + duration).toFixed(1));
      currentTime += duration;

      const stopWords = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "is", "was", "were", "are", "be", "been", "of", "it", "this", "that", "i", "you", "he", "she", "they", "we", "my", "your"]);
      const keywords = segmentText.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      
      const searchQuery = keywords.slice(0, 3).join(" ") || "abstract scenery";
      const prompt = `${imageStyle} style, highly detailed, atmospheric composition depicting: ${segmentText.replace(/[.\s]+$/, "")}`;

      segments.push({
        start,
        end,
        text: segmentText,
        prompt,
        searchQuery
      });
      fullSpeechScriptParts.push(segmentText);
    }
  });

  if (segments.length === 0) {
    segments.push({
      start: 0,
      end: 5.0,
      text: "FableForge cinematic studio starting...",
      prompt: `${imageStyle} style, cinematic abstract light rays`,
      searchQuery: "cinematic light rays"
    });
    fullSpeechScriptParts.push("FableForge cinematic studio starting...");
  }

  return {
    speechScript: fullSpeechScriptParts.join(" "),
    timeline: segments
  };
}

// Master query wrapper with robust retry & fallback models for 503/429 errors
async function generateContentWithRetryAndFallback(
  ai: any,
  payload: { contents: any; config: any },
  primaryModel: string,
  fallbackModels: string[] = ["gemini-2.5-flash", "gemini-1.5-flash"]
): Promise<any> {
  const modelsToTry = [primaryModel, ...fallbackModels];
  let lastError: any = null;

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const currentModel = modelsToTry[attempt];
    for (let retry = 0; retry < 2; retry++) {
      try {
        console.log(`[Gemini API] Querying model "${currentModel}" (Attempt ${retry + 1} for this model)...`);
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: payload.contents,
          config: payload.config,
        });
        if (response && response.text) {
          console.log(`[Gemini API] Success using model "${currentModel}"`);
          return response;
        }
        throw new Error("No response body returned from Gemini API");
      } catch (err: any) {
        lastError = err;
        const statusCode = err?.status || err?.code || (err?.message?.includes("503") ? 503 : err?.message?.includes("429") ? 429 : 500);
        console.log(`[Gemini API Info] Model "${currentModel}" status code ${statusCode}. Handled fallback option.`);
        
        if (statusCode === 400) {
          break; // Don't retry validation errors on the same model, proceed to fallback or stop
        }
        
        const delayMs = retry === 0 ? 800 : 1800;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("All fallback models completed with limit status");
}

// Endpoint to process transcript into structured humanized script and timing blocks
app.post("/api/process-transcript", async (req, res) => {
  const { transcript, errorLevel = "Mild", imageStyle = "cinematic" } = req.body;
  try {
    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({ error: "Transcript is required" });
      return;
    }

    const ai = getAIClient();

    const systemInstruction = `You are an expert audio producer and cinematic director. 
Your goal is to transform a plain text transcript into a "human-realistic speech script" containing natural speech errors, and build a synchronized storyboard with timed segments.

TASK 1: Create an ultra-lifelike Humanized Speech Script with simulated "Speech Errors".
Human conversational speech is rarely perfect. To make the generated text-to-speech sound realistic, organic, and humanlike, you must inject appropriate speech errors based on the user's requested error level:
- "None": Fluent reading. Keep the script clean, clear, and professional.
- "Mild": Add occasional brief hesitations, conversational contractions (e.g. "gonna", "wanna", "sorta", "y'know"), and minor fillers (like "uh...", "um...", "w-well") to make it sound natural (e.g., 2-3 minor fillers total).
- "High": Add frequent fillers ("uh...", "um...", "like...", "y'know"), slight stutters (e.g., "t-today...", "w-well..."), false starts, and verbal self-corrections (e.g., "we need to focus on... wait, actually, we should look at..."). Make it sound like an unscripted, spontaneous raw speaker.

CRITICAL FORMATTING RULES FOR HUMANLIKE TTS SYNTHESIS:
1. Use punctuation (commas, dashes, and ellipses) immediately around or after filler words (e.g., write "uh...", "um, so...", "well, actually...") to force the TTS model to take natural breathing pauses, change speaking cadence, and lower vocal pitch organically.
2. Spell stutter contractions phonetically (e.g., "th-that's", "t-to") to trigger high-fidelity acoustic stutters.
3. Keep the text phonetic and flowing. Avoid all robotic robotic sentence structures.

TASK 2: Segment the transcript into consecutive, timed intervals.
Estimate the timing of the spoken speech. Standard human speaking rate is approximately 2.5 to 3.0 words per second.
Break down the entire speech script into sequential, non-overlapping storyboard segments. Each segment should:
- Last between 3.5 to 7.0 seconds.
- Map precisely to the speechScript words.
- Start at 0.0 seconds and sequentially continue until the end of the text.
- Provide a corresponding descriptive visual 'prompt' that matches the content of that segment, stylized in the user's requested style (e.g., "\${imageStyle} style, detailed, artistic, immersive").
- Provide a simple, clean Unsplash search keyword query (e.g., "starry sky nebula space cinematic") to retrieve high-quality related photography as a fast fallback.

Your response MUST be valid JSON adhering strictly to the schema provided.`;

    const promptText = `Please process the following transcript with errorLevel: "${errorLevel}" and imageStyle: "${imageStyle}".

Transcript:
${transcript}`;

    const config = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          speechScript: {
            type: Type.STRING,
            description: "The full re-written transcript with realistic speech errors (fillers, stutters, corrections) corresponding to the requested error level."
          },
          timeline: {
            type: Type.ARRAY,
            description: "The sequential list of storyboard segments synchronized with the spoken text.",
            items: {
              type: Type.OBJECT,
              properties: {
                start: {
                  type: Type.NUMBER,
                  description: "Start timestamp in seconds (e.g., 0.0)."
                },
                end: {
                  type: Type.NUMBER,
                  description: "End timestamp in seconds (e.g., 5.2)."
                },
                text: {
                  type: Type.STRING,
                  description: "The spoken subtitle text for this segment, which must match the speechScript segment exactly (including fillers/errors)."
                },
                prompt: {
                  type: Type.STRING,
                  description: "A highly creative, detailed, descriptive prompt for generating an AI image for this segment. Incorporate the requested visual style: " + imageStyle
                },
                searchQuery: {
                  type: Type.STRING,
                  description: "A short, clean Unsplash search query keyword string (e.g., 'mysterious forest mist road') to fetch corresponding high-quality stock visuals."
                }
              },
              required: ["start", "end", "text", "prompt", "searchQuery"]
            }
          }
        },
        required: ["speechScript", "timeline"]
      }
    };

    let response;
    try {
      response = await generateContentWithRetryAndFallback(
        ai,
        { contents: promptText, config },
        "gemini-3.5-flash",
        ["gemini-2.5-flash", "gemini-1.5-flash"]
      );
    } catch (apiErr) {
      console.warn("[Gemini API] All AI endpoints failed or rate limited. Falling back to dynamic offline transcript segmenter.");
      const offlineResult = offlineProcessTranscript(transcript, errorLevel, imageStyle);
      res.json({ ...offlineResult, isOfflineFallback: true });
      return;
    }

    if (!response || !response.text) {
      throw new Error("No response text received from Gemini API");
    }

    const data = JSON.parse(response.text.trim());
    res.json(data);
  } catch (error: any) {
    console.log("[Process Transcript Fallback Handled]:", error.message || error);
    try {
      const offlineResult = offlineProcessTranscript(transcript, errorLevel, imageStyle);
      res.json({ ...offlineResult, isOfflineFallback: true, errorMsg: error.message });
    } catch (fallbackError) {
      res.status(500).json({ error: error.message || "Failed to process transcript storyboard metadata." });
    }
  }
});

// Endpoint to generate single-speaker TTS using Gemini TTS Model
app.post("/api/generate-tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Text is required" });
      return;
    }

    const ai = getAIClient();
    let base64Audio = "";

    // Retries up to 3 times in case of transient 503/429
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[TTS Generation] Querying gemini-3.1-flash-tts-preview (Attempt ${attempt + 1})...`);
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName },
              },
            },
          },
        });

        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
        if (base64Audio) {
          break; // Successful!
        }
      } catch (err: any) {
        console.warn(`[TTS Generation] Attempt ${attempt + 1} failed. Error: ${err.message || err}`);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 + attempt * 1000));
        }
      }
    }

    if (!base64Audio) {
      console.warn("[TTS Generation] Gemini TTS API failed. Providing robust silent audio track fallback.");
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.max(3.0, wordCount * 0.45); 
      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const bytesPerSample = bitsPerSample / 8;
      const totalBytes = Math.floor(estimatedDuration * sampleRate * numChannels * bytesPerSample);
      
      const pcmBuffer = Buffer.alloc(totalBytes); // filled with zeros (perfect silence)
      const wavBuffer = addWavHeader(pcmBuffer, sampleRate, numChannels, bitsPerSample);
      const wavBase64 = wavBuffer.toString("base64");

      res.json({ 
        audioData: wavBase64,
        isFallback: true,
        message: "Gemini voice model was offline or overloaded. Generated a smooth silent audio timeline so you can preview and export your storyboard seamlessly."
      });
      return;
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);
    const wavBase64 = wavBuffer.toString("base64");

    res.json({ audioData: wavBase64 });
  } catch (error: any) {
    console.log("[Generate TTS Fallback Handled]:", error.message || error);
    res.json({
      isFallback: true,
      audioData: null,
      errorMsg: error.message || "Failed to generate text-to-speech audio"
    });
  }
});

// Endpoint to generate AI images for specific timeline nodes
app.post("/api/generate-image", async (req, res) => {
  const { prompt, searchQuery } = req.body;
  try {
    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const ai = getAIClient();
    let response: any = null;
    let errorLog: string[] = [];

    // Attempt 1: Try gemini-3.1-flash-image (the latest high quality model)
    try {
      console.log(`[AI Image] Attempting image generation with gemini-3.1-flash-image for: "${prompt}"`);
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });
    } catch (err1: any) {
      const errMsg = err1?.message || String(err1);
      errorLog.push(errMsg);
      console.log(`[AI Image Info] Model gemini-3.1-flash-image is busy or quota limited.`);
    }

    // Attempt 2: Fallback to gemini-2.5-flash-image if first attempt failed
    if (!response) {
      try {
        console.log(`[AI Image] Attempting image generation fallback with gemini-2.5-flash-image...`);
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                text: prompt,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });
      } catch (err2: any) {
        const errMsg = err2?.message || String(err2);
        errorLog.push(errMsg);
        console.log(`[AI Image Info] Model gemini-2.5-flash-image is busy or quota limited.`);
      }
    }

    let base64Image = "";
    if (response) {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    // Attempt 3: Fetch custom high-fidelity AI-generated image from Pollinations AI (FLUX/SD)
    if (!base64Image) {
      try {
        console.log(`[AI Image Info] Gemini quota limited. Fetching direct high-quality AI-generated image from Pollinations AI for prompt: "${prompt}"`);
        const encodedPrompt = encodeURIComponent(prompt.trim());
        const randomSeed = Math.floor(Math.random() * 10000000);
        // Request a 16:9 cinematic ratio (e.g. 1024x576) with no logo/watermark
        const pollinationsUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=1024&height=576&nologo=true&seed=${randomSeed}`;
        
        const fetchRes = await fetch(pollinationsUrl);
        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          base64Image = buffer.toString("base64");
          console.log(`[AI Image Info] Successfully generated and compiled custom AI image from Pollinations AI.`);
        } else {
          console.log(`[AI Image Info] Pollinations AI endpoint returned status ${fetchRes.status}`);
        }
      } catch (err3: any) {
        console.log(`[AI Image Info] Failed to complete Pollinations AI fallback generation: ${err3.message || err3}`);
      }
    }

    if (base64Image) {
      res.json({ imageData: `data:image/png;base64,${base64Image}` });
    } else {
      // Graceful fallback: construct high-resolution Unsplash featured photo URL based on the searchQuery
      const queryTerm = searchQuery || "scenic abstract art";
      const sanitized = encodeURIComponent(queryTerm.trim().replace(/\s+/g, ","));
      const randomSig = "fallback_" + Math.floor(Math.random() * 1000000);
      const fallbackUrl = `https://images.unsplash.com/featured/1280x720/?${sanitized}&sig=${randomSig}`;
      
      console.log(`[AI Image Info] Quota limit reached. Gracefully served curated visual fallback: ${fallbackUrl}`);
      
      res.json({ 
        isFallback: true, 
        imageData: fallbackUrl,
        errorDetail: "Served from curated image asset library due to API rate limits."
      });
    }
  } catch (error: any) {
    console.log("[AI Image Endpoint Fallback Handled]:", error.message || error);
    const queryTerm = searchQuery || "scenic abstract art";
    const sanitized = encodeURIComponent(queryTerm.trim().replace(/\s+/g, ","));
    const randomSig = "fallback_" + Math.floor(Math.random() * 1000000);
    const fallbackUrl = `https://images.unsplash.com/featured/1280x720/?${sanitized}&sig=${randomSig}`;
    res.json({ 
      isFallback: true, 
      imageData: fallbackUrl,
      errorDetail: error.message || "Quota limit or model preview limitation."
    });
  }
});

// Endpoint to check if ffmpeg is available
app.get("/api/test-ffmpeg", async (req, res) => {
  const { exec } = await import("child_process");
  exec("ffmpeg -version", (err, stdout, stderr) => {
    if (err) {
      res.json({ available: false, error: err.message, stderr });
    } else {
      res.json({ available: true, stdout });
    }
  });
});

// Helper to pre-wrap text for clean display in ffmpeg
function wrapText(text: string, maxLen: number = 45): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    if (testLine.length > maxLen) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.join("\n");
}

// Helper to download or save image locally for video generation
async function saveImage(urlOrData: string, destPath: string): Promise<void> {
  const fs = await import("fs");
  if (urlOrData.startsWith("data:")) {
    const match = urlOrData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid base64 data URL format");
    }
    const buffer = Buffer.from(match[2], "base64");
    fs.writeFileSync(destPath, buffer);
  } else if (urlOrData.startsWith("http://") || urlOrData.startsWith("https://")) {
    const res = await fetch(urlOrData);
    if (!res.ok) {
      throw new Error(`Failed to fetch image from ${urlOrData}: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  } else {
    const path = await import("path");
    const localPath = path.isAbsolute(urlOrData) ? urlOrData : path.join(process.cwd(), urlOrData);
    if (fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, destPath);
    } else {
      throw new Error(`Invalid image URL or path: ${urlOrData}`);
    }
  }
}

// High-definition offline video compilation endpoint
app.post("/api/export-video", async (req, res) => {
  const { timeline, audioBase64, aspectRatio } = req.body;
  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
    return res.status(400).json({ error: "Missing or invalid timeline data" });
  }

  const { exec } = await import("child_process");
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fableforge-export-"));
  
  try {
    console.log(`[Video Export] Initiating server-side compilation in: ${tempDir} with Aspect Ratio: ${aspectRatio || "16:9"}`);
    
    // Write audio wav to disk
    const audioPath = path.join(tempDir, "audio.wav");
    if (audioBase64) {
      const base64Data = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(audioPath, audioBuffer);
    } else {
      const totalDur = timeline[timeline.length - 1].end;
      await new Promise<void>((resolve, reject) => {
        exec(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${totalDur} "${audioPath}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    const segmentListPath = path.join(tempDir, "segments.txt");

    // Process each node in the timeline
    const promises = timeline.map(async (node, idx) => {
      const imgPath = path.join(tempDir, `image_${idx}.png`);
      const txtPath = path.join(tempDir, `text_${idx}.txt`);
      const segPath = path.join(tempDir, `segment_${idx}.mp4`);
      
      // Save image to temp file
      await saveImage(node.imageUrl || "", imgPath);

      // Save wrapped subtitle text to temp file (prevents shell injection & quote bugs in drawtext)
      const wrappedText = wrapText(node.text || "", 45);
      fs.writeFileSync(txtPath, wrappedText, "utf-8");

      const duration = node.end - node.start;
      const escapedTxtPath = txtPath.replace(/'/g, "'\\''");

      // Dynamic Resolution & Subtitle Placement based on aspect ratio
      const scaleW = aspectRatio === "9:16" ? 720 : (aspectRatio === "1:1" ? 720 : 1280);
      const scaleH = aspectRatio === "9:16" ? 1280 : (aspectRatio === "1:1" ? 720 : 720);
      const subY = aspectRatio === "9:16" ? "h-180" : (aspectRatio === "1:1" ? "h-120" : "h-110");
      const subSize = aspectRatio === "16:9" ? 28 : 26;

      // Build video filter graph parts
      const filterParts = [
        `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease`,
        `pad=${scaleW}:${scaleH}:(${scaleW}-iw)/2:(${scaleH}-ih)/2`
      ];

      // 1. Basic adjustments: brightness, contrast, saturation
      const bVal = node.brightness !== undefined ? (node.brightness - 100) / 100 : 0;
      const cVal = node.contrast !== undefined ? node.contrast / 100 : 1.0;
      const sVal = node.saturation !== undefined ? node.saturation / 100 : 1.0;

      if (bVal !== 0 || cVal !== 1.0 || sVal !== 1.0) {
        filterParts.push(`eq=brightness=${bVal}:contrast=${cVal}:saturation=${sVal}`);
      }

      // 2. Specialized filters
      if (node.filter && node.filter !== "none") {
        if (node.filter === "mono") {
          filterParts.push("hue=s=0");
        } else if (node.filter === "sepia") {
          filterParts.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
        } else if (node.filter === "vintage") {
          filterParts.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.2:brightness=-0.05");
        } else if (node.filter === "warm") {
          filterParts.push("colorchannelmixer=1.1:0:0:0:0:0.95:0:0:0:0:0.8");
        } else if (node.filter === "cool") {
          filterParts.push("colorchannelmixer=0.85:0:0:0:0:0.95:0:0:0:0:1.15");
        } else if (node.filter === "invert") {
          filterParts.push("negate");
        } else if (node.filter === "sketch") {
          filterParts.push("hue=s=0,eq=contrast=2.5:brightness=-0.1");
        }
      }

      // 3. Blur filter
      if (node.blur !== undefined && node.blur > 0) {
        filterParts.push(`gblur=sigma=${node.blur}`);
      }

      // 4. Burn subtitles
      filterParts.push(`drawtext=fontfile=/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf:textfile='${escapedTxtPath}':x=(w-text_w)/2:y=${subY}:fontsize=${subSize}:fontcolor=white:box=1:boxcolor=0x0f172ae5:boxborderw=15`);

      const filterGraph = filterParts.join(",");

      // Compile this segment using ffmpeg with NimbusSans font and rich filters
      const cmd = `ffmpeg -y -loop 1 -i "${imgPath}" -t ${duration} -vf "${filterGraph}" -c:v libx264 -pix_fmt yuv420p -r 30 "${segPath}"`;
      
      await new Promise<void>((resolve, reject) => {
        exec(cmd, (err) => {
          if (err) {
            console.error(`[Video Export] Segment ${idx} compile failed:`, err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      return segPath;
    });

    const compiledSegments = await Promise.all(promises);

    // Create the concat list file
    const concatContent = compiledSegments.map(p => `file '${p}'`).join("\n");
    fs.writeFileSync(segmentListPath, concatContent);

    // Run final concatenation & audio merge
    const finalOutputPath = path.join(tempDir, "output.mp4");
    const mergeCmd = `ffmpeg -y -f concat -safe 0 -i "${segmentListPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v -map 1:a -shortest "${finalOutputPath}"`;

    await new Promise<void>((resolve, reject) => {
      exec(mergeCmd, (err) => {
        if (err) {
          console.error(`[Video Export] Concat merge failed:`, err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Read the compiled output back as base64
    const finalBuffer = fs.readFileSync(finalOutputPath);
    const base64Video = finalBuffer.toString("base64");

    console.log(`[Video Export] HD MP4 video generation complete! Size: ${finalBuffer.length} bytes.`);
    res.json({ videoBase64: base64Video });

  } catch (error: any) {
    console.error(`[Video Export Error]:`, error);
    res.status(500).json({ error: error.message || "Failed to compile storyboard video" });
  } finally {
    // Clean up entire temp directory asynchronously
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("[Video Export Cleanup Error]:", cleanupErr);
    }
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
