"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils/cn";

import { scanTicketAction, type ScanResult } from "./actions";

/**
 * The door scanner — scan ticket after ticket without leaving the page.
 *
 * The camera is read in the page (`getUserMedia`), and each frame is decoded
 * by the browser's own BarcodeDetector where it exists (Chrome, Android) and
 * by jsQR otherwise (Safari on iPhone has no BarcodeDetector); jsQR is loaded
 * only when needed. A scanned ticket is checked in at once, the verdict fills
 * the screen with a buzz, and scanning resumes by itself — with Undo for a
 * mistake. Typing the code is always there below, for a ticket that will not
 * scan (a cracked screen, a printout, a flat battery read aloud).
 *
 * The camera is allowed on these pages only (next.config.ts headers); the
 * rest of the site keeps it switched off.
 */

type Detector = (source: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;

const RESUME_AFTER_MS = 3000;
const SAME_CODE_QUIET_MS = 5000;

async function makeDetector(): Promise<Detector> {
  // BarcodeDetector is not in TypeScript's DOM library yet.
  const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (Native) {
    try {
      const detector = new Native({ formats: ["qr_code"] });
      return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
    } catch {
      // Present but without QR support: fall through to jsQR.
    }
  }
  const { default: jsQR } = await import("jsqr");
  return async (video, canvas) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;
    // Decode a downscaled frame: quicker, and a ticket QR is large in view.
    const scale = Math.min(1, 640 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

const VERDICT: Record<ScanResult["status"], { tone: "good" | "warn" | "bad"; title: string }> = {
  ok: { tone: "good", title: "Checked in" },
  undone: { tone: "warn", title: "Check-in undone" },
  already: { tone: "warn", title: "Already checked in" },
  cancelled: { tone: "bad", title: "Cancelled ticket" },
  not_found: { tone: "bad", title: "No such ticket" },
  wrong_event: { tone: "bad", title: "Ticket for another event" },
  invalid: { tone: "bad", title: "Not a ticket code" },
  forbidden: { tone: "bad", title: "You can't check people in" },
  error: { tone: "bad", title: "Something went wrong — try again" },
};

export function Scanner({ eventId }: { eventId: string | null }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => {
    stop();
    if (resumeRef.current) clearTimeout(resumeRef.current);
  }, [stop]);

  const submit = useCallback(
    (raw: string, undo = false) => {
      busyRef.current = true;
      startTransition(async () => {
        const verdict = await scanTicketAction(raw, eventId, undo).catch(
          (): ScanResult => ({ status: "error" }),
        );
        setResult(verdict);
        if ("vibrate" in navigator) navigator.vibrate(VERDICT[verdict.status].tone === "good" ? 80 : [60, 60, 60]);
        router.refresh();
        if (resumeRef.current) clearTimeout(resumeRef.current);
        resumeRef.current = setTimeout(() => {
          busyRef.current = false;
          // Clear the viewfinder for the next ticket; a typed result stays.
          if (streamRef.current) setResult(null);
        }, RESUME_AFTER_MS);
      });
    },
    [eventId, router],
  );

  const start = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser can't open the camera here. Type the code below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const detect = await makeDetector();
      const loop = async () => {
        if (!streamRef.current) return;
        if (!busyRef.current && video.readyState >= 2) {
          const text = await detect(video, canvasRef.current!).catch(() => null);
          const now = Date.now();
          const repeat = text && lastRef.current?.code === text && now - lastRef.current.at < SAME_CODE_QUIET_MS;
          if (text && !repeat) {
            lastRef.current = { code: text, at: now };
            submit(text);
          }
        }
        setTimeout(loop, 180);
      };
      loop();
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setCameraError(
        denied
          ? "Camera access was refused. Allow it in the browser's site settings, or type the code below."
          : "No camera could be opened. Type the code below instead.",
      );
      stop();
    }
  }, [stop, submit]);

  const verdict = result ? VERDICT[result.status] : null;

  // The verdict, large enough to read at arm's length. While the camera is
  // on it sits over the viewfinder, where the eyes already are; otherwise
  // under the code box.
  const verdictCard = (
    <div aria-live="assertive" className={cn(scanning ? "absolute inset-x-3 top-3" : "mt-4")}>
      {verdict && result ? (
          <div
            className={cn(
              "rounded-(--radius) p-5 text-center",
              scanning && "shadow-lift backdrop-blur-md",
              verdict.tone === "good" && (scanning ? "bg-surface text-success ring-4 ring-success" : "bg-success/15 text-success"),
              verdict.tone === "warn" && (scanning ? "bg-surface text-warning ring-4 ring-warning" : "bg-warning/15 text-warning"),
              verdict.tone === "bad" && (scanning ? "bg-surface text-error ring-4 ring-error" : "bg-error/12 text-error"),
            )}
          >
            <p className="font-display text-2xl font-semibold">{verdict.title}</p>
            {result.name ? <p className="mt-1 text-lg font-semibold text-foreground">{result.name}</p> : null}
            {result.status === "wrong_event" && result.event ? (
              <p className="mt-1 text-foreground">This ticket is for {result.event}.</p>
            ) : null}
            {result.status === "already" && result.checkedInAt ? (
              <p className="mt-1 text-foreground">
                Arrived{" "}
                {new Date(result.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
              </p>
            ) : null}
            {result.reference ? <p className="mt-1 font-mono text-sm tracking-wider text-muted-foreground">{result.reference}</p> : null}
            {result.status === "ok" && result.reference ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(result.reference!, true)}
                className="mt-3 text-sm font-medium text-muted-foreground underline underline-offset-4"
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : null}
    </div>
  );

  return (
    <section aria-label="Scan tickets" className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Scan tickets</h2>
        {scanning ? (
          <button type="button" onClick={stop} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">
            Stop camera
          </button>
        ) : (
          <button type="button" onClick={start} className="h-10 rounded-full bg-button px-5 text-sm font-semibold text-button-foreground">
            Start scanning
          </button>
        )}
      </div>

      {/* The viewfinder: kept mounted so the stream has somewhere to go. */}
      <div className={cn("relative mt-4 overflow-hidden rounded-(--radius) bg-block-noir", scanning ? "aspect-square max-h-[60svh] sm:aspect-video" : "hidden")}>
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
        <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white">Hold the ticket&apos;s QR code in the square</p>
        {scanning ? verdictCard : null}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? <p className="mt-3 text-sm text-error">{cameraError}</p> : null}

      {/* The backup: always available, same result as a scan. */}
      <form
        className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          submit(code);
          setCode("");
        }}
      >
        <label className="grid flex-1 gap-1 text-sm font-medium">
          Can&apos;t scan? Type the ticket code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="TK-XXXXXXXX"
            className="h-12 min-w-0 rounded-(--radius) border border-border bg-background px-3 font-mono text-lg tracking-wider uppercase"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-full bg-button px-6 font-semibold text-button-foreground disabled:opacity-60"
        >
          {pending ? "Checking…" : "Check in"}
        </button>
      </form>
      {scanning ? null : verdictCard}
    </section>
  );
}
