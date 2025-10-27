export interface FormData {
  id: string;
  name: string;
  email: string;
  message: string;
  timestamp: number;
}

export interface QueueItem {
  id: string;
  data: FormData;
  timestamp: number;
  retryCount: number;
  encrypted: boolean;
  lastAttempt?: number;
  status: "pending" | "saving" | "failed" | "completed" | "abandoned";
  isPaused?: boolean;
}

export interface SaveHistoryItem {
  id: string;
  data: FormData;
  timestamp: number;
  attempts: number;
  status: "success" | "failed" | "abandoned";
  error?: string;
  completedAt: number;
}

export interface AppState {
  isOnline: boolean;
  currentForm: FormData;
  saveQueue: QueueItem[];
  isSaving: boolean;
  lastSaveTimestamp: number | null;
  saveError: string | null;
  saveHistory: SaveHistoryItem[];
  pendingFormData: FormData | null; // Temporary storage when queue is paused
  isQueuePaused: boolean;
}
