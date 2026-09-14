import React, { useRef, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Loader2, Download, Copy, Check, Image as ImageIcon } from 'lucide-react';
import ShareCard from './ShareCard';
import { captureCardAsPng, copyShareText } from '@/lib/shareCard';

const PREVIEW_SIZE = 300;
const PREVIEW_SCALE = PREVIEW_SIZE / 1080;

/**
 * Bottom-sheet share modal. Renders the full 1080×1080 card off-screen for
 * html2canvas capture, plus a scaled preview and Download / Copy Text CTAs.
 *
 * Props: { open, onOpenChange, card, filename, textFallback }
 */
export default function ShareSheet({ open, onOpenChange, card, filename = 'astrosetta-card', textFallback = '' }) {
  const captureRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    try {
      await captureCardAsPng(captureRef.current, filename);
    } catch {
      /* non-critical */
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    const ok = await copyShareText(textFallback);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Off-screen full-size card for html2canvas capture */}
      {card && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: -99999,
            top: 0,
            width: 1080,
            height: 1080,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <ShareCard ref={captureRef} card={card} />
        </div>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t border-gold-primary/30 bg-[#0f1a2e] px-5 pb-7 pt-4 text-white"
        >
          <SheetHeader className="text-center">
            <SheetTitle className="font-display text-base font-semibold text-gold-accent">
              Share Card
            </SheetTitle>
            <SheetDescription className="font-body text-[11px] text-brass/60">
              Download a 1080×1080 image for Instagram &amp; Pinterest, or copy a text version for X.
            </SheetDescription>
          </SheetHeader>

          {/* Scaled preview */}
          <div className="flex justify-center my-4">
            <div
              style={{
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                overflow: 'hidden',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left', width: 1080, height: 1080 }}>
                {card && <ShareCard card={card} />}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold-primary py-3 font-body text-xs font-semibold text-[#0f1a2e] transition hover:bg-gold-accent disabled:opacity-50"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? 'Rendering…' : 'Download Image'}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-xl border border-gold-primary/40 py-3 font-body text-xs font-semibold text-gold-accent transition hover:bg-gold-primary/10"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 font-body text-[10px] text-brass/40 italic text-center">
            <ImageIcon size={10} /> Watermarked with the Astrosetta logo — free to share.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}