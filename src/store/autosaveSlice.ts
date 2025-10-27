import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import type { FormData } from "../types";

export interface QueueItem {
  id: string;
  data: FormData;
  timestamp: number;
  encrypted: boolean;
  attempts: number;
  status: "pending" | "processing" | "completed" | "failed" | "abandoned";
  lastAttempt?: number;
  completedAt?: number;
  error?: string;
  processingStarted?: number;
}

// Unified item that represents the complete lifecycle
export interface UnifiedQueueItem extends QueueItem {
  // Computed properties for display
  isActive: boolean; // true if pending or processing
  isCompleted: boolean; // true if completed, failed, or abandoned
  duration?: number; // time from creation to completion
  processingDuration?: number; // time spent in processing state
}

interface AutosaveState {
  // Form state
  currentForm: FormData;
  isOnline: boolean;

  // Unified queue management - contains all items (active and completed)
  allItems: QueueItem[];

  // Queue settings
  maxRetries: number;
  retryDelay: number;
  // Backoff strategy settings
  backoffMultiplier: number; // How much to multiply delay by for each retry (e.g., 2.0 for doubling)
  maxBackoffDelay: number; // Maximum delay in milliseconds (e.g., 30 seconds)
  jitterEnabled: boolean; // Add random jitter to prevent thundering herd
}

const initialState: AutosaveState = {
  currentForm: {
    id: "",
    name: "",
    email: "",
    message: "",
    timestamp: Date.now(),
  },
  isOnline: true,
  allItems: [], // This will contain all items throughout their lifecycle
  maxRetries: Infinity, // Unlimited retries - only manual save can abandon items
  retryDelay: 1000, // Base delay: 1 second
  backoffMultiplier: 2.0, // Double the delay each retry
  maxBackoffDelay: 30000, // Maximum 30 seconds
  jitterEnabled: true, // Add random jitter (±25%)
};

// Helper function to calculate backoff delay with exponential backoff strategy
export const calculateBackoffDelay = (
  baseDelay: number,
  attempt: number,
  multiplier: number,
  maxDelay: number,
  jitterEnabled: boolean = true
): number => {
  // Calculate exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);

  // Apply maximum delay cap
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter if enabled (±25% random variation)
  if (jitterEnabled) {
    const jitterRange = cappedDelay * 0.25; // 25% jitter
    const jitter = (Math.random() - 0.5) * 2 * jitterRange; // Random between -jitterRange and +jitterRange
    return Math.max(cappedDelay + jitter, baseDelay); // Never go below base delay
  }

  return cappedDelay;
};

const autosaveSlice = createSlice({
  name: "autosave",
  initialState,
  reducers: {
    // Update form data (for Redux form state if needed)
    updateForm: (state, action: PayloadAction<Partial<FormData>>) => {
      state.currentForm = { ...state.currentForm, ...action.payload };
    },

    // Set online/offline status
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },

    // Queue a new save
    queueSave: (state, action: PayloadAction<FormData>) => {
      const queueItem: QueueItem = {
        id: uuidv4(),
        data: action.payload,
        timestamp: Date.now(),
        encrypted: false, // We can encrypt later if needed
        attempts: 0,
        status: "pending",
      };

      state.allItems.push(queueItem);
      console.log(`➕ Queued item ${queueItem.id}`);
    },

    // Start processing an item
    startProcessing: (state, action: PayloadAction<string>) => {
      const item = state.allItems.find((q) => q.id === action.payload);
      if (item) {
        item.status = "processing";
        item.attempts += 1;
        item.lastAttempt = Date.now();
        item.processingStarted = Date.now();
        console.log(`� Processing item ${item.id} (attempt ${item.attempts})`);
      }
    },

    // Mark item as completed
    completeItem: (state, action: PayloadAction<string>) => {
      const item = state.allItems.find((q) => q.id === action.payload);
      if (item) {
        // Check for duplicate data in recent completed items (last 5 entries)
        const recentCompleted = state.allItems
          .filter((i) => i.status === "completed")
          .slice(-5);

        const isDuplicate = recentCompleted.some(
          (completedItem) =>
            JSON.stringify(completedItem.data) === JSON.stringify(item.data)
        );

        item.status = "completed";
        item.completedAt = Date.now();

        if (isDuplicate) {
          console.log(`✅ Completed item ${item.id} (duplicate data detected)`);
        } else {
          console.log(`✅ Completed item ${item.id} (unique save)`);
        }
      }
    },

    // Mark item as failed
    failItem: (state, action: PayloadAction<{ id: string; error: string }>) => {
      const item = state.allItems.find((q) => q.id === action.payload.id);
      if (item) {
        item.error = action.payload.error;
        item.lastAttempt = Date.now();

        // Always mark as failed for retry - never abandon automatically
        // Items can only be abandoned via manual save (abandonUnprocessedItems action)
        item.status = "failed";
        console.log(
          `❌ Failed item ${item.id} (attempt ${item.attempts}) - will retry with backoff`
        );
      }
    },

    // Retry a failed item (keeps attempt count for backoff)
    retryItem: (state, action: PayloadAction<string>) => {
      const item = state.allItems.find((q) => q.id === action.payload);
      if (item && (item.status === "failed" || item.status === "abandoned")) {
        item.status = "pending";
        item.error = undefined;
        // DO NOT reset attempts - keep the count for exponential backoff calculation
        item.lastAttempt = undefined; // Clear last attempt timestamp so it can be retried immediately
        item.completedAt = undefined; // Clear completion timestamp if it was abandoned
        console.log(
          `🔄 Auto-retrying item ${item.id} (keeping attempt count: ${item.attempts} for backoff calculation)`
        );
      }
    },

    // Manual retry with fresh start (resets attempt count)
    manualRetryItem: (state, action: PayloadAction<string>) => {
      const item = state.allItems.find((q) => q.id === action.payload);
      if (item && (item.status === "failed" || item.status === "abandoned")) {
        item.status = "pending";
        item.error = undefined;
        item.attempts = 0; // Reset attempts counter for manual fresh retry
        item.lastAttempt = undefined; // Clear last attempt timestamp
        item.completedAt = undefined; // Clear completion timestamp if it was abandoned
        console.log(
          `🔄 Manual retry item ${item.id} (attempts reset to 0 for fresh start)`
        );
      }
    },

    // Retry all failed items (keeps attempt counts for backoff)
    retryFailedItems: (state) => {
      const failedItems = state.allItems.filter(
        (item) => item.status === "failed" || item.status === "abandoned"
      );

      failedItems.forEach((item) => {
        item.status = "pending";
        item.error = undefined;
        // DO NOT reset attempts - keep the count for exponential backoff calculation
        item.lastAttempt = undefined; // Clear last attempt timestamp so they can be retried immediately
        item.completedAt = undefined; // Clear completion timestamp if it was abandoned
      });

      console.log(
        `🔄 Auto-retrying ${failedItems.length} failed items (keeping attempt counts for backoff calculation)`
      );
    },

    // Manual retry all failed items (resets attempt counts)
    manualRetryFailedItems: (state) => {
      const failedItems = state.allItems.filter(
        (item) => item.status === "failed" || item.status === "abandoned"
      );

      failedItems.forEach((item) => {
        item.status = "pending";
        item.error = undefined;
        item.attempts = 0; // Reset attempts counter for manual fresh retry
        item.lastAttempt = undefined; // Clear last attempt timestamp
        item.completedAt = undefined; // Clear completion timestamp if it was abandoned
      });

      console.log(
        `🔄 Manual retry ${failedItems.length} failed items (attempts reset to 0 for fresh start)`
      );
    },

    // Clear completed items (keep active ones)
    clearCompleted: (state) => {
      const activeItems = state.allItems.filter(
        (item) => item.status === "pending" || item.status === "processing"
      );

      const removedCount = state.allItems.length - activeItems.length;
      state.allItems = activeItems;

      console.log(`🗑️ Cleared ${removedCount} completed items`);
    },

    // Clear all items
    clearQueue: (state) => {
      const itemCount = state.allItems.length;
      state.allItems = [];
      console.log(`🗑️ Cleared all ${itemCount} items`);
    },

    // Remove specific item
    removeQueueItem: (state, action: PayloadAction<string>) => {
      const index = state.allItems.findIndex(
        (item) => item.id === action.payload
      );
      if (index !== -1) {
        const item = state.allItems[index];
        state.allItems.splice(index, 1);
        console.log(`🗑️ Removed item ${item.id}`);
      }
    },

    // Set retry settings
    setRetrySettings: (
      state,
      action: PayloadAction<{
        maxRetries?: number;
        retryDelay?: number;
        backoffMultiplier?: number;
        maxBackoffDelay?: number;
        jitterEnabled?: boolean;
      }>
    ) => {
      if (action.payload.maxRetries !== undefined) {
        state.maxRetries = action.payload.maxRetries;
      }
      if (action.payload.retryDelay !== undefined) {
        state.retryDelay = action.payload.retryDelay;
      }
      if (action.payload.backoffMultiplier !== undefined) {
        state.backoffMultiplier = action.payload.backoffMultiplier;
      }
      if (action.payload.maxBackoffDelay !== undefined) {
        state.maxBackoffDelay = action.payload.maxBackoffDelay;
      }
      if (action.payload.jitterEnabled !== undefined) {
        state.jitterEnabled = action.payload.jitterEnabled;
      }

      console.log("⚙️ Updated retry settings:", {
        maxRetries: state.maxRetries,
        retryDelay: state.retryDelay,
        backoffMultiplier: state.backoffMultiplier,
        maxBackoffDelay: state.maxBackoffDelay,
        jitterEnabled: state.jitterEnabled,
      });
    },

    // Abandon unprocessed items (for manual save override)
    abandonUnprocessedItems: (state) => {
      const unprocessedItems = state.allItems.filter(
        (item) => item.status === "pending" || item.status === "failed"
      );

      unprocessedItems.forEach((item) => {
        item.status = "abandoned";
        item.completedAt = Date.now();
        item.error = "Superseded by manual save";
      });

      console.log(
        `🚫 Abandoned ${unprocessedItems.length} unprocessed items due to manual save`
      );
    },
  },
});

// Selectors for different item states
export const selectActiveItems = (state: { autosave: AutosaveState }) =>
  state.autosave.allItems.filter(
    (item) => item.status === "pending" || item.status === "processing"
  );

export const selectPendingItems = (state: { autosave: AutosaveState }) =>
  state.autosave.allItems.filter((item) => item.status === "pending");

export const selectProcessingItems = (state: { autosave: AutosaveState }) =>
  state.autosave.allItems.filter((item) => item.status === "processing");

export const selectCompletedItems = (state: { autosave: AutosaveState }) =>
  state.autosave.allItems.filter(
    (item) =>
      item.status === "completed" ||
      item.status === "failed" ||
      item.status === "abandoned"
  );

export const selectFailedItems = (state: { autosave: AutosaveState }) =>
  state.autosave.allItems.filter(
    (item) => item.status === "failed" || item.status === "abandoned"
  );

// Selector for backoff configuration
export const selectBackoffConfig = (state: { autosave: AutosaveState }) => ({
  retryDelay: state.autosave.retryDelay,
  backoffMultiplier: state.autosave.backoffMultiplier,
  maxBackoffDelay: state.autosave.maxBackoffDelay,
  jitterEnabled: state.autosave.jitterEnabled,
});

// Enhanced selector that adds computed properties
export const selectUnifiedItems = (state: {
  autosave: AutosaveState;
}): UnifiedQueueItem[] =>
  state.autosave.allItems.map((item) => ({
    ...item,
    isActive: item.status === "pending" || item.status === "processing",
    isCompleted:
      item.status === "completed" ||
      item.status === "failed" ||
      item.status === "abandoned",
    duration: item.completedAt ? item.completedAt - item.timestamp : undefined,
    processingDuration:
      item.processingStarted && item.completedAt
        ? item.completedAt - item.processingStarted
        : undefined,
  }));

export const {
  updateForm,
  setOnlineStatus,
  queueSave,
  startProcessing,
  completeItem,
  failItem,
  retryItem,
  manualRetryItem,
  retryFailedItems,
  manualRetryFailedItems,
  clearCompleted,
  clearQueue,
  removeQueueItem,
  setRetrySettings,
  abandonUnprocessedItems,
} = autosaveSlice.actions;

export default autosaveSlice.reducer;
