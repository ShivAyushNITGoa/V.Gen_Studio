export interface TimelineNode {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;  // spoken words / subtitles
  prompt: string; // descriptive AI prompt
  searchQuery: string; // search query for stock visuals
  imageUrl: string; // URL of visual asset to display
  isGenerating?: boolean; // image generation indicator
  isAiGenerated?: boolean; // indicates if the image is an AI generated image
  filter?: "none" | "vintage" | "warm" | "cool" | "mono" | "sepia" | "invert" | "sketch";
  brightness?: number; // 50 to 150 (default 100)
  contrast?: number;   // 50 to 150 (default 100)
  saturation?: number; // 50 to 150 (default 100)
  blur?: number;       // 0 to 10 (default 0)
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  description: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore (Female - Energetic)', gender: 'female', description: 'Bright, crisp, and high-clarity voice' },
  { id: 'Aoede', name: 'Aoede (Female - Calm/Sophisticated)', gender: 'female', description: 'Clear, smooth, conversational tone' },
  { id: 'Puck', name: 'Puck (Female - Playful)', gender: 'female', description: 'Expressive and friendly storytelling voice' },
  { id: 'Charon', name: 'Charon (Male - Mature)', gender: 'male', description: 'Commanding, clear, and professional voice' },
  { id: 'Fenrir', name: 'Fenrir (Male - Nordic)', gender: 'male', description: 'Unique, deep, and dramatic resonance' },
];

export interface ImageStyleOption {
  id: string;
  name: string;
  promptShorthand: string;
}

export const IMAGE_STYLES: ImageStyleOption[] = [
  { id: 'cinematic', name: 'Cinematic Movie Shot', promptShorthand: 'photorealistic cinematic movie scene, dramatic lighting, shot on 35mm, highly detailed' },
  { id: 'anime', name: 'Anime / Ghibli', promptShorthand: 'gorgeous studio ghibli anime illustration style, soft colors, magical realism, detailed background' },
  { id: 'digital-art', name: 'Vaporwave / Cyberpunk', promptShorthand: 'cyberpunk digital artwork style, neon glowing colors, futuristic cityscape synthwave aesthetic' },
  { id: 'watercolor', name: 'Soft Watercolor', promptShorthand: 'soft watercolor illustration, artistic paint brush strokes, light pastel tones, beautiful fantasy' },
  { id: 'oil-painting', name: 'Fine Art Oil Painting', promptShorthand: 'classical fine art oil painting style, visible canvas texture, rich pigments, masterwork' },
  { id: 'line-art', name: 'Minimalist Sketch', promptShorthand: 'clean minimalist line art sketch, subtle shading, elegant and modern look' },
];
