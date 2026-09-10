import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { getOrchestrator } from "../lib/orchestrator";
import { logger } from "../lib/logger";

export const transcribeRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
];

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim() || mimeType;
}

transcribeRouter.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("audio")(req, res, (err: unknown) => {
      if (err) {
        logger.error({ err }, "audio upload error");
        res.status(413).json({ message: "Audio file too large" });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No audio file provided" });
        return;
      }

      const mimeType = normalizeMimeType(file.mimetype);
      if (!ALLOWED_AUDIO_TYPES.some((type) => mimeType.startsWith(type))) {
        res.status(400).json({ message: "Unsupported audio format" });
        return;
      }

      const orchestrator = getOrchestrator();
      const text = await orchestrator.transcribeAudio({
        audio: file.buffer,
        mimeType,
      });

      res.json({ text });
    } catch (err) {
      logger.error({ err }, "transcribe error");
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  },
);
