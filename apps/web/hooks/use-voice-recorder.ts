"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/api";

const SUPPORTED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

const MAX_DURATION_MS = 60_000;

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return SUPPORTED_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

interface UseVoiceRecorderOptions {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
}

export function useVoiceRecorder({
  onTranscribed,
  onError,
}: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const onTranscribedRef = useRef(onTranscribed);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscribedRef.current = onTranscribed;
    onErrorRef.current = onError;
  }, [onTranscribed, onError]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldTranscribeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(blob);
      const trimmed = text.trim();
      if (trimmed) {
        onTranscribedRef.current(trimmed);
      } else {
        onErrorRef.current?.("Couldn't hear anything. Try again.");
      }
    } catch {
      onErrorRef.current?.("Transcription failed. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (mediaRecorderRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];
      shouldTranscribeRef.current = false;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        const shouldTranscribe = shouldTranscribeRef.current;
        shouldTranscribeRef.current = false;

        mediaRecorderRef.current = null;
        cleanupTracks();
        setIsRecording(false);

        if (shouldTranscribe) {
          void transcribe(blob);
        }
      };

      recorder.onerror = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        mediaRecorderRef.current = null;
        cleanupTracks();
        setIsRecording(false);
        onErrorRef.current?.("Recording failed. Please try again.");
      };

      recorder.start();
      setIsRecording(true);

      timeoutRef.current = setTimeout(() => {
        shouldTranscribeRef.current = true;
        finishRecording();
      }, MAX_DURATION_MS);
    } catch (err) {
      cleanupTracks();
      const name = (err as DOMException | undefined)?.name;
      if (name === "NotAllowedError") {
        onErrorRef.current?.("Microphone permission was denied.");
      } else if (name === "NotFoundError") {
        onErrorRef.current?.("No microphone was found.");
      } else if (name === "NotReadableError") {
        onErrorRef.current?.("Microphone is busy or unavailable.");
      } else {
        onErrorRef.current?.("Unable to access the microphone.");
      }
    }
  }, [cleanupTracks, finishRecording, transcribe]);

  const confirm = useCallback(() => {
    shouldTranscribeRef.current = true;
    finishRecording();
  }, [finishRecording]);

  const cancel = useCallback(() => {
    shouldTranscribeRef.current = false;
    finishRecording();
  }, [finishRecording]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { isRecording, isTranscribing, start, confirm, cancel };
}
