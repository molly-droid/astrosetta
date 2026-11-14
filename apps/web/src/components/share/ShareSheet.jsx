import React, { useEffect, useRef, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Loader2, Download, Copy, Check, Image as ImageIcon } from 'lucide-react';
import ShareCard, { cardSize } from './ShareCard';
import { renderCardAsPngBlob, shareNativeCardAsPng, copyShareText } from '@/lib/shareCard';
import { prepareBrowserShareImage, releaseBrowserShareImage, canShareImage, sharePreparedImage, isShareCancelled } from '@/lib/browserShareImage';
import { isNativePlatform } from '@/lib/platform';


/**
 * Bottom-sheet share modal. Renders the full-size card off-screen for
 * html2canvas capture, plus a scaled preview and Download / Copy Text CTAs.
 *
 * Props: { open, onOpenChange, card, filename, textFallback, variants }
 * F-04: `variants` — [{ key, label, card, textFallback }] — adds a
 * "Share for everyone" / "Share my reading" choice; the first is the default.
 */
export default function ShareSheet({ open, onOpenChange, card: singleCard, filename = 'astrosetta-card', textFallback: singleText = '', variants = null }) {
  const captureRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [variantKey, setVariantKey] = useState(null);
  const [theme, setTheme] = useState('blue');
  const [availableWidth, setAvailableWidth] = useState(() => typeof window === 'undefined' ? 300 : window.innerWidth - 40);
  useEffect(() => {
    const resize = () => setAvailableWidth(window.innerWidth - 40);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const active = variants?.length ? (variants.find(v => v.key === variantKey) || variants[0]) : null;
  const card = active ? active.card : singleCard;
  const textFallback = active ? (active.textFallback ?? active.card?.textFallback ?? '') : singleText;
  const size = cardSize(card);
  const PREVIEW_WIDTH = Math.min(card?.format === 'story' ? 190 : 300, availableWidth);
  const previewScale = PREVIEW_WIDTH / size.width;
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [imageState, setImageState] = useState(null);
  const nativeShare = isNativePlatform();
  const imageFilename = active ? `${filename}-${active.key}` : filename;
  const prepared = open && imageState?.card === card && imageState?.theme === theme && imageState?.filename === imageFilename && !imageState.image.released
    ? imageState.image : null;
  const browserShare = !nativeShare && canShareImage(prepared);
  const preparing = open && !nativeShare && !prepared && !renderError;

  useEffect(() => {
    if (!open || nativeShare || !card) return;
    let cancelled = false;
    let image;
    setImageState(null);
    setRenderError(null);
    setSaveError(null);
    (async () => {
      try {
        const blob = await renderCardAsPngBlob(captureRef.current, { width: size.width, height: size.height });
        image = prepareBrowserShareImage(blob, imageFilename);
        if (!cancelled) setImageState({ card, theme, filename: imageFilename, image });
        else releaseBrowserShareImage(image);
      } catch {
        if (!cancelled) setRenderError("The image couldn't be prepared. Please try again.");
      }
    })();
    return () => { cancelled = true; if (image) releaseBrowserShareImage(image); };
  }, [open, nativeShare, card, theme, imageFilename, size.width, size.height, renderAttempt]);

  const handleDownload = async () => {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    setSaveError(null);
    try {
      await shareNativeCardAsPng(captureRef.current, imageFilename, size);
    } catch (err) {
      // A cancelled native share sheet is a normal outcome, not a failure.
      if (!isShareCancelled(err)) setSaveError("The image couldn't be saved. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleBrowserShare = async () => {
    if (!prepared || downloading) return;
    setDownloading(true);
    setSaveError(null);
    try {
      // No render/await before this call: Safari requires the original tap.
      await sharePreparedImage(prepared);
    } catch (error) {
      if (!isShareCancelled(error)) setSaveError('Sharing is unavailable. Use one of the save options below.');
    } finally { setDownloading(false); }
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
            width: size.width,
            height: size.height,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          <ShareCard ref={captureRef} card={card} theme={theme} />
        </div>
      )}

      <Sheet open={open} onOpenChange={(o) => { if (!o) setVariantKey(null); onOpenChange?.(o); }}>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement; }}
          onCloseAutoFocus={event => { event.preventDefault(); returnFocusRef.current?.focus(); }}
          className="max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-gold-primary/30 bg-[#0f1a2e] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4 text-white [&>button]:top-1 [&>button]:right-1 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"
        >
          <SheetHeader className="text-center">
            <SheetTitle className="font-display text-base font-semibold text-gold-accent">
              Share Card
            </SheetTitle>
            <SheetDescription className="font-body text-[0.6875rem] text-brass/60">
              {card?.format === 'story'
                ? 'Save or share a 1080×1920 image sized for Stories, or copy the text.'
                : 'Save or share a 1080×1080 image, or copy the reading as text.'}
            </SheetDescription>
          </SheetHeader>

          {variants?.length > 1 && (
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-gold-primary/25 p-1" role="group" aria-label="Reading to share">
              {variants.map(v => (
                <button
                  key={v.key}
                  aria-pressed={active?.key === v.key}
                  disabled={downloading}
                  onClick={() => setVariantKey(v.key)}
                  className={`rounded-lg py-2 font-body text-[0.6875rem] font-semibold transition ${active?.key === v.key ? 'bg-gold-primary text-[#0f1a2e]' : 'text-gold-accent hover:bg-gold-primary/10'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <fieldset className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <legend className="float-left mr-3 font-body text-xs leading-[44px] text-brass">Card colour</legend>
            {[{ key: 'blue', label: 'Blue', swatch: '#0f1a2e' }, { key: 'cream', label: 'Cream', swatch: '#FDFBF7' }].map(option => (
              <button key={option.key} type="button" aria-pressed={theme === option.key}
                disabled={downloading} onClick={() => setTheme(option.key)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-body text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-accent disabled:opacity-50 ${theme === option.key ? 'border-gold-accent text-gold-accent' : 'border-white/20 text-white/70'}`}>
                <span aria-hidden="true" className="h-4 w-4 rounded-full border border-white/30" style={{ background: option.swatch }} />
                {option.label}{theme === option.key && <Check size={12} aria-hidden="true" />}
              </button>
            ))}
          </fieldset>

          {/* Scaled preview */}
          <div className="flex justify-center my-4">
            <div
              style={{
                width: PREVIEW_WIDTH,
                height: size.height * previewScale,
                overflow: 'hidden',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: size.width, height: size.height }}>
                {card && <ShareCard card={card} theme={theme} />}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            {nativeShare || browserShare || !prepared ? (
            <button
              onClick={nativeShare ? handleDownload : handleBrowserShare}
              disabled={downloading || (!nativeShare && !prepared)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold-primary py-3 font-body text-xs font-semibold text-[#0f1a2e] transition hover:bg-gold-accent disabled:opacity-50"
            >
              {downloading || preparing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {preparing ? 'Preparing image…' : downloading ? 'Opening…' : 'Save or Share'}
            </button>
            ) : (
              <a href={prepared.url} download={prepared.filename}
                className="flex items-center justify-center gap-2 rounded-xl bg-gold-primary py-3 font-body text-xs font-semibold text-[#0f1a2e] hover:bg-gold-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                <Download size={15} aria-hidden="true" /> Download Image
              </a>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-xl border border-gold-primary/40 py-3 font-body text-xs font-semibold text-gold-accent transition hover:bg-gold-primary/10"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
            {(saveError || renderError) && (
              <p role="alert" className="col-span-2 text-center font-body text-xs text-red-300">{saveError || renderError}</p>
            )}
            {renderError && !nativeShare && <button onClick={() => setRenderAttempt(value => value + 1)} className="col-span-2 min-h-11 rounded-lg border border-gold-primary/40 font-body text-xs text-gold-accent">Try again</button>}
          </div>

          {!nativeShare && prepared && (
            <details key={prepared.url} open={!!saveError || undefined} className="mt-3 rounded-xl border border-gold-primary/25 p-3 font-body text-xs text-brass">
              <summary className="min-h-11 cursor-pointer content-center text-gold-accent">Other ways to save the image</summary>
              <p className="leading-relaxed mb-3">On iPhone or iPad, touch and hold the image below, then choose Save to Photos or Save Image. You can also open it in a new tab.</p>
              <div className="flex flex-wrap gap-x-5 mb-3">
                <a href={prepared.url} download={prepared.filename} className="inline-flex min-h-11 items-center underline underline-offset-4 text-gold-accent">Download PNG</a>
                <a href={prepared.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 text-gold-accent">Open image<span className="sr-only"> in a new tab</span></a>
              </div>
              <img src={prepared.url} alt={card?.title || 'Astrosetta reading card'} width={size.width} height={size.height} className="block w-full max-w-sm h-auto mx-auto rounded-xl" />
            </details>
          )}

          <p className="mt-3 flex items-center justify-center gap-1.5 font-body text-[0.625rem] text-brass/40 italic text-center">
            <ImageIcon size={10} /> Watermarked with the Astrosetta logo — free to share.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
