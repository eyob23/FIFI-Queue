import { useEffect, useRef, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAppDispatch, useAppSelector } from "./redux";
import { useSaveFormMutation } from "../store/formApi";
import {
  queueSave,
  startProcessing,
  completeItem,
  failItem,
  selectPendingItems,
  selectBackoffConfig,
  retryItem,
  calculateBackoffDelay,
} from "../store/autosaveSlice";
import { mockBackend } from "../services/mockBackend";
import type { FormData } from "../types";

interface UseAutosaveProps {
  data: Partial<FormData>;
}

export const useAutosave = ({ data }: UseAutosaveProps) => {
  const dispatch = useAppDispatch();
  const pendingItems = useAppSelector(selectPendingItems);
  const { allItems, isOnline } = useAppSelector((state) => state.autosave);
  const backoffConfig = useAppSelector(selectBackoffConfig);

  // RTK Query mutation
  const [saveForm, { isLoading }] = useSaveFormMutation();

  // Track last saved state to avoid duplicates
  const lastSavedRef = useRef<string>("");

  // Track if we're currently processing to prevent loops
  const isProcessingRef = useRef<boolean>(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<number | null>(null);

  // Helper to serialize form data for comparison
  const serializeData = useCallback((formData: Partial<FormData>) => {
    return JSON.stringify({
      name: formData.name?.trim() || "",
      email: formData.email?.trim() || "",
      message: formData.message?.trim() || "",
    });
  }, []);

  // Helper to check if form has content
  const hasContent = useCallback((formData: Partial<FormData>) => {
    return Object.values(formData).some(
      (value) => value && typeof value === "string" && value.trim().length > 0
    );
  }, []);

  // Memoize the serialized data to prevent unnecessary comparisons
  const serializedData = useMemo(
    () => serializeData(data),
    [data, serializeData]
  );

  // Note: We don't need to update Redux form state since we're using react-hook-form
  // The form state is managed by react-hook-form, Redux only manages the queue

  // Autosave function (not debounced yet)
  const performSave = useCallback(() => {
    console.log("🚀 performSave called with data:", serializedData);

    // Only save if there's content and it's different from last save
    if (hasContent(data) && serializedData !== lastSavedRef.current) {
      console.log("💾 Queueing autosave (debounced):", serializedData);
      lastSavedRef.current = serializedData;

      // Queue the save
      const formDataToSave: FormData = {
        id: uuidv4(),
        name: data.name || "",
        email: data.email || "",
        message: data.message || "",
        timestamp: Date.now(),
      };

      dispatch(queueSave(formDataToSave));
    } else {
      console.log("⏭️ Skipping save - no content or no changes");
    }
  }, [data, serializedData, hasContent, dispatch]);

  // Debounced save with proper cleanup
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = window.setTimeout(() => {
      performSave();
    }, 1000); // 1 second debounce

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [serializedData, performSave]); // Only depend on serialized data and performSave

  // Dedicated timer for checking and triggering retries of failed items
  // This ensures failed items get retried even if the main processing loop is slow
  useEffect(() => {
    if (!isOnline) return;

    const checkAndTriggerRetries = () => {
      // Get all failed items that might be ready for retry
      const failedItems = allItems.filter(
        (item) => item.status === "failed" && item.lastAttempt
      );

      failedItems.forEach((item) => {
        const backoffDelay = calculateBackoffDelay(
          backoffConfig.retryDelay,
          item.attempts - 1,
          backoffConfig.backoffMultiplier,
          backoffConfig.maxBackoffDelay,
          backoffConfig.jitterEnabled
        );

        const timeSinceLastAttempt = Date.now() - item.lastAttempt!;

        if (timeSinceLastAttempt >= backoffDelay) {
          console.log(
            `⏰ Retry timer: Failed item ${
              item.id
            } ready for retry after ${Math.ceil(
              backoffDelay / 1000
            )}s backoff (attempt ${item.attempts})`
          );
          dispatch(retryItem(item.id));
        }
      });
    };

    // Check every second for failed items ready to retry
    const intervalId = setInterval(checkAndTriggerRetries, 1000);

    return () => clearInterval(intervalId);
  }, [isOnline, allItems, backoffConfig, dispatch]);

  // Process pending queue items with RTK Query (controlled to prevent loops)
  useEffect(() => {
    const processNextItem = async () => {
      // Get current backend status for debugging
      const backendConfig = mockBackend.getConfig();

      // Prevent concurrent processing
      if (isProcessingRef.current || !isOnline || isLoading) {
        if (!isOnline) {
          console.log("⏸️ Queue processing paused: Redux offline");
        }
        if (isLoading) {
          console.log(
            "⏸️ Queue processing paused: RTK Query mutation in progress"
          );
        }
        return;
      }

      // STRICT FIFO: Get the oldest unprocessed item (pending OR failed) to maintain order
      // Sort by timestamp to ensure true FIFO order
      const unprocessedItems = allItems
        .filter((item) => item.status === "pending" || item.status === "failed")
        .sort((a, b) => a.timestamp - b.timestamp); // Oldest first

      const nextItem = unprocessedItems[0];

      if (!nextItem) {
        console.log("⏸️ Queue processing paused: No unprocessed items");
        return;
      }

      // If the oldest item is failed, check if it's ready for retry
      if (nextItem.status === "failed") {
        if (!nextItem.lastAttempt) {
          // No lastAttempt means it was just retried, treat as pending
          console.log(`🔄 Processing recently retried item ${nextItem.id}`);
          dispatch(retryItem(nextItem.id));
          return; // Let next cycle process it as pending
        }

        // Calculate backoff delay for the oldest failed item
        const backoffDelay = calculateBackoffDelay(
          backoffConfig.retryDelay,
          nextItem.attempts - 1,
          backoffConfig.backoffMultiplier,
          backoffConfig.maxBackoffDelay,
          backoffConfig.jitterEnabled
        );

        const timeSinceLastAttempt = Date.now() - nextItem.lastAttempt;

        if (timeSinceLastAttempt < backoffDelay) {
          const remainingTime = Math.ceil(
            (backoffDelay - timeSinceLastAttempt) / 1000
          );
          console.log(
            `⏸️ FIFO WAIT: Oldest item ${nextItem.id} needs ${remainingTime}s more backoff. Queue blocked to maintain FIFO order.`
          );
          return; // Block the entire queue to maintain FIFO order
        }

        // Oldest failed item is ready for retry
        console.log(
          `🔄 FIFO retry: Oldest item ${nextItem.id} ready after backoff`
        );
        dispatch(retryItem(nextItem.id));
        return; // Let next cycle process it as pending
      }

      isProcessingRef.current = true;
      console.log(
        `🚀 Processing queue item: ${nextItem.id} (attempt ${
          nextItem.attempts + 1
        }) - FIFO order`
      );
      console.log(
        `📊 Backend status: ${
          backendConfig.isServerDown ? "DOWN" : "UP"
        }, Failure rate: ${(backendConfig.failureRate * 100).toFixed(0)}%`
      );

      try {
        // Mark as processing
        dispatch(startProcessing(nextItem.id));

        // Use RTK Query to save
        console.log("📡 Making RTK Query API call...");
        const result = await saveForm(nextItem.data).unwrap();

        console.log(`✅ Save successful:`, result);
        dispatch(completeItem(nextItem.id));
      } catch (error) {
        console.error(`❌ Save failed:`, error);
        dispatch(
          failItem({
            id: nextItem.id,
            error:
              (error as any)?.data?.message ||
              (error as any)?.message ||
              "Unknown error",
          })
        );
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Determine processing interval based on queue state
    const hasFailedItems = allItems.some((item) => item.status === "failed");
    const processingInterval = hasFailedItems ? 1000 : 500; // Check every 1s if there are failed items

    // Use interval for processing instead of timeout
    const timeoutId = setTimeout(processNextItem, processingInterval);

    return () => clearTimeout(timeoutId);
  }, [isOnline, allItems, isLoading, saveForm, dispatch, backoffConfig]); // Added backoffConfig back since we use it for FIFO blocking

  return {
    isProcessing: isLoading,
    queueLength: allItems.length,
    pendingCount: pendingItems.length,
    isOnline: isOnline,
    hasFailures: allItems.some(
      (item) => item.status === "failed" || item.status === "abandoned"
    ),
    hasActiveQueue:
      pendingItems.length > 0 ||
      allItems.some((item) => item.status === "processing"),
    isAutosaveActive:
      isProcessingRef.current || isLoading || pendingItems.length > 0,
  };
};
