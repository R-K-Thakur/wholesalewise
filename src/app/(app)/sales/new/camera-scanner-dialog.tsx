"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, AlertCircle, Sparkles, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CameraScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export function CameraScannerDialog({
  isOpen,
  onClose,
  onBarcodeDetected,
}: CameraScannerDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  const [hasCameraAccess, setHasCameraAccess] = React.useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [lastScanned, setLastScanned] = React.useState<string | null>(null);
  const [manualCode, setManualCode] = React.useState("");

  const stopStream = React.useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDetectedCode = React.useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;

      // Haptic feedback on mobile if supported
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(60);
        } catch {
          // ignore
        }
      }

      setLastScanned(clean);
      onBarcodeDetected(clean);

      // Brief pause before scanning again to prevent duplicate rapid trigger
      setTimeout(() => {
        setLastScanned(null);
      }, 1500);
    },
    [onBarcodeDetected]
  );

  React.useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let isMounted = true;

    async function initCamera() {
      setErrorMessage(null);
      setHasCameraAccess(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported by your browser or requires HTTPS.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasCameraAccess(true);
        }

        // Start scanning loop if BarcodeDetector is available
        const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

        if (hasBarcodeDetector) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
          });

          setIsDetecting(true);

          const scanLoop = async () => {
            if (!isMounted || !videoRef.current || videoRef.current.readyState < 2) {
              animationFrameRef.current = requestAnimationFrame(scanLoop);
              return;
            }

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDetectedCode(barcodes[0].rawValue);
              }
            } catch (err) {
              // detection frame error
            }

            animationFrameRef.current = requestAnimationFrame(scanLoop);
          };

          animationFrameRef.current = requestAnimationFrame(scanLoop);
        } else {
          setIsDetecting(false);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Camera error:", err);
        setHasCameraAccess(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not access camera. Please check permissions."
        );
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, stopStream, handleDetectedCode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDetectedCode(manualCode.trim());
      setManualCode("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Camera Barcode Scanner
          </DialogTitle>
          <DialogDescription className="text-xs">
            Point your device camera at a product barcode or QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-black flex flex-col items-center justify-center min-h-[300px] max-h-[420px] overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover max-h-[380px]"
          />

          {/* Viewfinder Target Box Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-36 border-2 border-primary/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
              {/* Scan laser line animation */}
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse absolute top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Detection Alert Badge */}
          {lastScanned && (
            <div className="absolute top-4 bg-emerald-600 text-white font-semibold text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
              <Check className="h-4 w-4" /> Scanned: {lastScanned}
            </div>
          )}

          {/* Fallback / Error view */}
          {errorMessage && (
            <div className="absolute inset-0 bg-background/95 p-5 flex flex-col items-center justify-center text-center space-y-2">
              <div className="h-11 w-11 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Camera Requires Secure HTTPS</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Mobile browsers (Android Chrome & iOS Safari) block camera access on local IP addresses (<code className="font-mono text-[11px] bg-muted px-1 rounded">http://192.168...</code>) for security reasons.
                </p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-md text-left text-[11px] text-muted-foreground max-w-xs space-y-1">
                <p className="font-medium text-foreground">💡 How to bill right now:</p>
                <p>• Use the <strong>⚡ Quick-Pick Products</strong> grid (1-tap billing without camera).</p>
                <p>• Type product name or barcode in the input below.</p>
                <p>• On computer, open <code className="font-mono bg-muted px-1 rounded">http://localhost:9002</code> (Localhost is trusted as secure).</p>
                <p>• In live production (e.g. Firebase), HTTPS is automatic and the camera works on all phones.</p>
              </div>
            </div>
          )}
        </div>

        {/* Manual Barcode Input Bar */}
        <div className="p-4 bg-card border-t space-y-2">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Or enter barcode number manually..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="text-base sm:text-sm h-10"
              autoFocus={!hasCameraAccess}
            />
            <Button type="submit" size="sm" className="h-10 px-4">
              Add
            </Button>
          </form>
          <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
            <span>Supports EAN-13, UPC, Code-128 & QR</span>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
