"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  Download,
  ImagePlus,
  MonitorDown,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Backdrop = "studio" | "white" | "graphite" | "custom";
type NormalizedBox = { x: number; y: number; width: number; height: number };
type CanvasSize = { width: number; height: number };
type Point = { x: number; y: number };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const MAX_FILE_BYTES = 24 * 1024 * 1024;

const BACKDROPS: Array<{
  id: Exclude<Backdrop, "custom">;
  label: string;
  swatch: string;
}> = [
  {
    id: "studio",
    label: "Soft studio",
    swatch: "linear-gradient(145deg, #ffffff 10%, #dfe5e8 100%)",
  },
  { id: "white", label: "Pure white", swatch: "#ffffff" },
  {
    id: "graphite",
    label: "Graphite",
    swatch: "linear-gradient(145deg, #59636d 0%, #202a33 100%)",
  },
];

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be opened."));
    image.src = source;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function normaliseBox(start: Point, end: Point): NormalizedBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

export default function MotorMatteEditor() {
  const carInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderSequence = useRef(0);

  const [carFile, setCarFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [customBackdropUrl, setCustomBackdropUrl] = useState("");
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1600, height: 1067 });
  const [backdrop, setBackdrop] = useState<Backdrop>("studio");
  const [redactPlates, setRedactPlates] = useState(false);
  const [blurStrength, setBlurStrength] = useState(22);
  const [plateBoxes, setPlateBoxes] = useState<NormalizedBox[]>([]);
  const [markMode, setMarkMode] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragEnd, setDragEnd] = useState<Point | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Choose a photo to begin");
  const [error, setError] = useState("");
  const [previewTab, setPreviewTab] = useState("after");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);

  const activeSelection =
    dragStart && dragEnd ? normaliseBox(dragStart, dragEnd) : null;

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const paintCanvas = useCallback(
    async (target: HTMLCanvasElement) => {
      const sourceUrl = cutoutUrl || originalUrl;
      if (!sourceUrl) return;

      target.width = canvasSize.width;
      target.height = canvasSize.height;
      const context = target.getContext("2d");
      if (!context) return;

      if (backdrop === "white") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, target.width, target.height);
      } else if (backdrop === "graphite") {
        const gradient = context.createLinearGradient(0, 0, target.width, target.height);
        gradient.addColorStop(0, "#66717b");
        gradient.addColorStop(0.48, "#35414b");
        gradient.addColorStop(1, "#17212a");
        context.fillStyle = gradient;
        context.fillRect(0, 0, target.width, target.height);
      } else if (backdrop === "custom" && customBackdropUrl) {
        const backgroundImage = await loadImage(customBackdropUrl);
        drawCover(context, backgroundImage, target.width, target.height);
      } else {
        const gradient = context.createLinearGradient(0, 0, 0, target.height);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.68, "#edf1f3");
        gradient.addColorStop(1, "#d7dde1");
        context.fillStyle = gradient;
        context.fillRect(0, 0, target.width, target.height);
        context.fillStyle = "rgba(72, 87, 98, 0.07)";
        context.beginPath();
        context.ellipse(
          target.width / 2,
          target.height * 0.84,
          target.width * 0.34,
          target.height * 0.075,
          0,
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      const sourceImage = await loadImage(sourceUrl);
      context.drawImage(sourceImage, 0, 0, target.width, target.height);

      if (redactPlates && plateBoxes.length) {
        const snapshot = document.createElement("canvas");
        snapshot.width = target.width;
        snapshot.height = target.height;
        snapshot.getContext("2d")?.drawImage(target, 0, 0);

        for (const box of plateBoxes) {
          context.save();
          context.beginPath();
          context.rect(
            box.x * target.width,
            box.y * target.height,
            box.width * target.width,
            box.height * target.height,
          );
          context.clip();
          context.filter = `blur(${blurStrength}px)`;
          context.drawImage(snapshot, 0, 0);
          context.restore();
        }
      }
    },
    [backdrop, blurStrength, canvasSize, customBackdropUrl, cutoutUrl, originalUrl, plateBoxes, redactPlates],
  );

  useEffect(() => {
    const target = canvasRef.current;
    if (!target || (!cutoutUrl && !originalUrl)) return;
    const sequence = ++renderSequence.current;
    paintCanvas(target).catch(() => {
      if (sequence === renderSequence.current) {
        setError("The preview could not be refreshed. Try choosing the image again.");
      }
    });
  }, [paintCanvas, cutoutUrl, originalUrl]);

  async function chooseCar(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Use a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That photo is larger than 24 MB. Choose a smaller copy.");
      return;
    }

    setError("");
    setProcessing(false);
    setProgress(0);
    setCutoutUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setPlateBoxes([]);
    setRedactPlates(false);
    setPreviewTab("after");

    const nextUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(nextUrl);
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
      setCanvasSize({
        width: Math.max(1, Math.round(image.naturalWidth * scale)),
        height: Math.max(1, Math.round(image.naturalHeight * scale)),
      });
      setOriginalUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setCarFile(file);
      setStatus("Ready to remove the background");
    } catch {
      URL.revokeObjectURL(nextUrl);
      setError("This photo could not be opened.");
    }
  }

  function onCarInput(event: ChangeEvent<HTMLInputElement>) {
    void chooseCar(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDraggingFile(false);
    void chooseCar(event.dataTransfer.files?.[0]);
  }

  async function removeCarBackground() {
    if (!carFile || processing) return;
    setError("");
    setProcessing(true);
    setProgress(6);
    setStatus("Preparing the on-device AI model…");

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const canUseWebGpu = Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
      const result = await removeBackground(carFile, {
        device: canUseWebGpu ? "gpu" : "cpu",
        model: "isnet_quint8",
        output: { format: "image/png", quality: 1, type: "foreground" },
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            setProgress((previous) => Math.max(previous, Math.round(8 + (current / total) * 82)));
          }
        },
      });
      const nextUrl = URL.createObjectURL(result);
      setCutoutUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setProgress(100);
      setStatus("Background removed — choose the finish you want");
      setPreviewTab("after");
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unknown processing error";
      setError(`Background removal failed. ${detail}`);
      setStatus("Ready to try again");
    } finally {
      setProcessing(false);
    }
  }

  function chooseCustomBackdrop(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const nextUrl = URL.createObjectURL(file);
    setCustomBackdropUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextUrl;
    });
    setBackdrop("custom");
  }

  function pointerPosition(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function beginPlateMark(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!markMode || !cutoutUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    setDragStart(point);
    setDragEnd(point);
  }

  function movePlateMark(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!markMode || !dragStart) return;
    setDragEnd(pointerPosition(event));
  }

  function finishPlateMark(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!markMode || !dragStart) return;
    const box = normaliseBox(dragStart, pointerPosition(event));
    if (box.width > 0.015 && box.height > 0.012) {
      setPlateBoxes((boxes) => [...boxes, box]);
    }
    setDragStart(null);
    setDragEnd(null);
    setMarkMode(false);
  }

  async function downloadResult() {
    if (!carFile || !cutoutUrl) return;
    setStatus("Preparing your finished photo…");
    const exportCanvas = document.createElement("canvas");
    await paintCanvas(exportCanvas);
    exportCanvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("The finished image could not be created.");
          return;
        }
        const link = document.createElement("a");
        const downloadUrl = URL.createObjectURL(blob);
        const baseName = carFile.name.replace(/\.[^.]+$/, "");
        link.href = downloadUrl;
        link.download = `${baseName}-motormatte.jpg`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        setStatus("Downloaded — ready for your listing");
      },
      "image/jpeg",
      0.94,
    );
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function resetEditor() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    if (customBackdropUrl) URL.revokeObjectURL(customBackdropUrl);
    setCarFile(null);
    setCutoutUrl("");
    setOriginalUrl("");
    setCustomBackdropUrl("");
    setPlateBoxes([]);
    setRedactPlates(false);
    setBackdrop("studio");
    setProgress(0);
    setStatus("Choose a photo to begin");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#eef2f4] text-[#0b1620]">
      <header className="border-b border-[#cbd5da] bg-white/95 px-4 backdrop-blur md:px-8">
        <div className="mx-auto flex min-h-18 max-w-[1480px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/motormatte-logo.png" alt="" className="h-11 w-11 object-contain" />
            <div>
              <p className="text-xl font-bold tracking-[-0.035em]">MotorMatte</p>
              <p className="text-xs font-medium text-[#52636e]">Car photos, listing ready</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-[#e6faf5] px-3 py-2 text-sm font-semibold text-[#0b6654] sm:flex">
              <ShieldCheck className="h-4 w-4" />
              Photos stay on this device
            </div>
            {installPrompt && (
              <Button variant="outline" onClick={() => void installApp()} className="h-10 rounded-xl border-[#b8c5cb]">
                <MonitorDown />
                <span className="hidden sm:inline">Install app</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-5 p-4 md:p-6 xl:grid-cols-[390px_minmax(0,1fr)] xl:p-8">
        <aside className="rounded-[28px] bg-[#0b1620] p-5 text-white shadow-[0_22px_70px_rgba(16,34,44,0.15)] md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#27e0b3]">PHOTO WORKFLOW</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em]">Prepare a clean car listing</h1>
            </div>
            {carFile && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={resetEditor}
                aria-label="Start over"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <RotateCcw />
              </Button>
            )}
          </div>

          <section className="workflow-section">
            <div className="step-number">1</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Add your car photo</h2>
              <p className="mt-1 text-sm leading-6 text-[#aebbc3]">JPG, PNG or WebP · up to 24 MB</p>
              <div
                className={`mt-3 rounded-2xl border border-dashed p-4 transition ${
                  draggingFile ? "border-[#27e0b3] bg-[#16352e]" : "border-[#40505b] bg-white/[0.035]"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDraggingFile(false)}
                onDrop={onDrop}
              >
                <input
                  ref={carInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onCarInput}
                  className="sr-only"
                />
                <Button
                  onClick={() => carInputRef.current?.click()}
                  variant="secondary"
                  className="h-11 w-full rounded-xl bg-white text-[#0b1620] hover:bg-[#e8eef0]"
                >
                  <UploadCloud />
                  {carFile ? "Choose another photo" : "Choose car photo"}
                </Button>
                {carFile && (
                  <p className="mt-2 truncate text-center text-xs text-[#bdc8ce]">{carFile.name}</p>
                )}
              </div>
            </div>
          </section>

          <section className="workflow-section">
            <div className={`step-number ${carFile ? "step-ready" : ""}`}>2</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Remove the background</h2>
              <p className="mt-1 text-sm leading-6 text-[#aebbc3]">The first run downloads a small AI model, then keeps it cached.</p>
              <Button
                onClick={() => void removeCarBackground()}
                disabled={!carFile || processing}
                className="mt-3 h-11 w-full rounded-xl bg-[#27e0b3] font-bold text-[#06291f] hover:bg-[#52ebc8] disabled:bg-[#40505b] disabled:text-[#89969d]"
              >
                <Sparkles />
                {processing ? "Removing background…" : cutoutUrl ? "Run background removal again" : "Remove background"}
              </Button>
              {processing && <Progress value={progress} className="mt-3 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#27e0b3]" />}
            </div>
          </section>

          <section className="workflow-section">
            <div className={`step-number ${cutoutUrl ? "step-ready" : ""}`}>3</div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Choose a neutral backdrop</h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {BACKDROPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBackdrop(item.id)}
                    disabled={!cutoutUrl}
                    className={`backdrop-option ${backdrop === item.id ? "backdrop-selected" : ""}`}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <span className="backdrop-swatch" style={{ background: item.swatch }} />
                    {backdrop === item.id && <Check className="backdrop-check" />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => backdropInputRef.current?.click()}
                  disabled={!cutoutUrl}
                  className={`backdrop-option ${backdrop === "custom" ? "backdrop-selected" : ""}`}
                  aria-label="Upload your own background"
                  title="Upload your own background"
                >
                  {customBackdropUrl ? (
                    <span className="backdrop-swatch bg-cover bg-center" style={{ backgroundImage: `url(${customBackdropUrl})` }} />
                  ) : (
                    <span className="backdrop-swatch flex items-center justify-center bg-[#172630] text-[#27e0b3]"><ImagePlus className="h-5 w-5" /></span>
                  )}
                  {backdrop === "custom" && <Check className="backdrop-check" />}
                </button>
                <input
                  ref={backdropInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    chooseCustomBackdrop(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-[#8fa0aa]">Last tile: upload your own background</p>
            </div>
          </section>

          <section className="workflow-section border-b-0 pb-0">
            <div className={`step-number ${cutoutUrl ? "step-ready" : ""}`}>4</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Blur number plates</h2>
                  <p className="mt-1 text-sm text-[#aebbc3]">Optional privacy tool</p>
                </div>
                <Switch
                  checked={redactPlates}
                  disabled={!cutoutUrl}
                  onCheckedChange={(checked) => {
                    setRedactPlates(checked);
                    if (!checked) setMarkMode(false);
                  }}
                  aria-label="Blur number plates"
                  className="data-[state=checked]:bg-[#27e0b3]"
                />
              </div>
              {redactPlates && (
                <div className="mt-3 rounded-2xl bg-white/[0.055] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      onClick={() => setMarkMode(true)}
                      variant="outline"
                      className={`h-10 flex-1 rounded-xl border-[#54636d] bg-transparent text-white hover:bg-white/10 hover:text-white ${markMode ? "border-[#27e0b3] text-[#27e0b3]" : ""}`}
                    >
                      Mark a plate
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!plateBoxes.length}
                      onClick={() => setPlateBoxes((boxes) => boxes.slice(0, -1))}
                      aria-label="Undo last plate mark"
                      className="text-white hover:bg-white/10 hover:text-white"
                    >
                      <Undo2 />
                    </Button>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-[#9fadb5]">Blur</span>
                    <Slider value={[blurStrength]} min={10} max={38} step={1} onValueChange={(value) => setBlurStrength(value[0])} />
                    <span className="w-7 text-right text-xs text-[#9fadb5]">{blurStrength}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#9fadb5]">
                    {markMode ? "Drag a box over the plate in the preview." : `${plateBoxes.length} plate area${plateBoxes.length === 1 ? "" : "s"} marked.`}
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="flex min-h-[620px] min-w-0 flex-col rounded-[28px] border border-[#cbd5da] bg-white shadow-[0_22px_70px_rgba(16,34,44,0.09)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe2e6] px-5 py-4 md:px-6">
            <div>
              <p className="text-sm font-bold text-[#0b1620]">Listing preview</p>
              <p className="mt-0.5 text-sm text-[#62737d]">{status}</p>
            </div>
            <Button
              onClick={() => void downloadResult()}
              disabled={!cutoutUrl || processing}
              className="h-11 rounded-xl bg-[#0b1620] px-5 text-white hover:bg-[#1d303b]"
            >
              <Download />
              Download JPG
            </Button>
          </div>

          {error && (
            <div role="alert" className="mx-5 mt-5 rounded-2xl border border-[#f1b8ae] bg-[#fff1ee] px-4 py-3 text-sm text-[#8e281b] md:mx-6">
              {error}
            </div>
          )}

          <Tabs value={previewTab} onValueChange={setPreviewTab} className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <TabsList className="rounded-xl bg-[#edf2f4] p-1">
                <TabsTrigger value="after" disabled={!carFile} className="rounded-lg px-4">Finished</TabsTrigger>
                <TabsTrigger value="before" disabled={!carFile} className="rounded-lg px-4">Original</TabsTrigger>
              </TabsList>
              {carFile && <p className="hidden text-xs text-[#71818b] md:block">Output: {canvasSize.width} × {canvasSize.height}px</p>}
            </div>

            <TabsContent value="after" className="min-h-0 flex-1">
              <div className={`preview-stage ${markMode ? "marking" : ""}`}>
                {carFile ? (
                  <div
                    className="relative w-full max-w-full"
                    style={{
                      aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                      maxWidth: `min(100%, ${((canvasSize.width / canvasSize.height) * 68).toFixed(2)}vh)`,
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      onPointerDown={beginPlateMark}
                      onPointerMove={movePlateMark}
                      onPointerUp={finishPlateMark}
                      onPointerCancel={() => {
                        setDragStart(null);
                        setDragEnd(null);
                      }}
                      className="block h-full max-h-[68vh] w-full max-w-full rounded-[18px] object-contain shadow-[0_18px_45px_rgba(9,24,33,0.18)]"
                      aria-label="Finished car photo preview"
                    />
                    {redactPlates && [...plateBoxes, ...(activeSelection ? [activeSelection] : [])].map((box, index) => (
                      <span
                        key={`${box.x}-${box.y}-${index}`}
                        className={`selection-box ${index === plateBoxes.length && activeSelection ? "selection-active" : ""}`}
                        style={{
                          left: `${box.x * 100}%`,
                          top: `${box.y * 100}%`,
                          width: `${box.width * 100}%`,
                          height: `${box.height * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-preview">
                    <div className="empty-frame">
                      <img src="/motormatte-logo.png" alt="" className="h-24 w-24 object-contain" />
                    </div>
                    <h2 className="mt-6 text-2xl font-bold tracking-[-0.035em]">Your finished car photo will appear here</h2>
                    <p className="mt-2 max-w-md text-base leading-7 text-[#60717b]">Choose a well-lit photo with the whole car visible for the cleanest result.</p>
                    <Button onClick={() => carInputRef.current?.click()} className="mt-5 h-11 rounded-xl bg-[#0b1620] text-white hover:bg-[#1d303b]">
                      <UploadCloud /> Choose photo
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="before" className="min-h-0 flex-1">
              <div className="preview-stage">
                {originalUrl && (
                  <img src={originalUrl} alt="Original uploaded car" className="max-h-[68vh] max-w-full rounded-[18px] object-contain shadow-[0_18px_45px_rgba(9,24,33,0.18)]" />
                )}
              </div>
            </TabsContent>
          </Tabs>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe2e6] px-5 py-4 text-xs text-[#60717b] md:px-6">
            <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#0b8068]" /> No account, upload or watermark</span>
            <span>Free and open-source · AGPL-3.0</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
