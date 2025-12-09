
// MODULE: Speaker Recognition & Vocal Expression
// Implementation of design document requirements for Browser Environment

export interface VocalMetaDataObject {
  speaker: string;
  speed_wpm: number;
  timbre: {
    brightness: number;
    warmth: number;
  };
  pitch: {
    average_hz: number;
    variance: number;
    contour_type: 'flat' | 'rising' | 'falling' | 'volatile';
  };
  energy: {
    rms: number;
    dynamic_range: number;
  };
  emotion: string;
  urgency_level: 'low' | 'medium' | 'high';
  tone: string;
  laban_mapping: {
    weight: 'light' | 'strong';
    space: 'direct' | 'indirect';
    time: 'sudden' | 'sustained';
    flow: 'bound' | 'free';
  };
  confidence: number;
  timestamp: number;
}

export interface SpeakerIdentityObject {
  speaker_id: string;
  speaker_confidence: number;
  is_known: boolean;
}

class SpeakerDatabase {
  private profiles: Map<string, { baseline_energy: number }> = new Map();

  enroll(name: string) {
    this.profiles.set(name, { baseline_energy: 0.1 });
    console.log(`[SpeakerDB] Enrolled: ${name}`);
  }

  list() {
    return Array.from(this.profiles.keys());
  }

  exists(name: string) {
    return this.profiles.has(name);
  }
}

class VocalExpressionAnalyzer {
  analyze(audioData: Float32Array, rms: number): Partial<VocalMetaDataObject> {
    // 1. Analyze Pitch (Zero Crossing Rate approximation for performance)
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0 && audioData[i - 1] < 0) || (audioData[i] < 0 && audioData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const approximateFreq = zeroCrossings / (audioData.length / 44100) / 2;

    // 2. Map Energy to Weight (Laban)
    const weight = rms > 0.15 ? 'strong' : 'light';

    // 3. Map Frequency variance/speed to Time (Laban)
    // (Simulated speed based on transient density)
    const time = approximateFreq > 500 ? 'sudden' : 'sustained';

    // 4. Infer Emotion Heuristics
    let emotion = 'neutral';
    let urgency: 'low' | 'medium' | 'high' = 'low';

    if (rms > 0.25 && approximateFreq > 600) {
      emotion = 'excited';
      urgency = 'high';
    } else if (rms > 0.2) {
      emotion = 'focused';
      urgency = 'medium';
    } else if (rms < 0.05) {
      emotion = 'calm';
    }

    return {
      pitch: {
        average_hz: Math.round(approximateFreq),
        variance: 0,
        contour_type: 'flat'
      },
      energy: {
        rms: rms,
        dynamic_range: 0
      },
      emotion,
      urgency_level: urgency,
      laban_mapping: {
        weight,
        space: 'direct',
        time,
        flow: 'free'
      }
    };
  }
}

export class SpeakerRecognitionAndVocalExpressionModule {
  private db: SpeakerDatabase;
  private analyzer: VocalExpressionAnalyzer;
  private currentSpeaker: string = "Unknown";
  private isProcessing: boolean = false;

  constructor() {
    this.db = new SpeakerDatabase();
    this.analyzer = new VocalExpressionAnalyzer();
    // Default enrollment
    this.db.enroll("User"); 
  }

  // API 8.2
  enrollSpeaker(name: string): boolean {
    this.db.enroll(name);
    this.currentSpeaker = name; // Auto-switch for simulation
    return true;
  }

  listSpeakers() {
    return this.db.list();
  }

  setCurrentSpeaker(name: string) {
    if (this.db.exists(name)) {
      this.currentSpeaker = name;
    }
  }

  // API 8.5 (Real-time processing hook)
  processAudioFrame(audioData: Float32Array): VocalMetaDataObject | null {
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // Noise Gate
    if (rms < 0.02) return null; 

    const analysis = this.analyzer.analyze(audioData, rms);

    return {
      speaker: this.currentSpeaker,
      speed_wpm: 0, // Requires longer window
      timbre: { brightness: 0.5, warmth: 0.5 },
      pitch: analysis.pitch!,
      energy: analysis.energy!,
      emotion: analysis.emotion!,
      urgency_level: analysis.urgency_level!,
      tone: 'neutral',
      laban_mapping: analysis.laban_mapping!,
      confidence: 0.9,
      timestamp: Date.now()
    };
  }
}

export const speakerModule = new SpeakerRecognitionAndVocalExpressionModule();
