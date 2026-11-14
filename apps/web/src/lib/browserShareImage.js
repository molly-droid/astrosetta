export function prepareBrowserShareImage(blob, filename, urls = URL) {
  if (!blob || blob.type !== 'image/png') throw new Error('The PNG image could not be prepared.');
  const name = `${String(filename).replace(/\.png$/i, '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 120) || 'astrosetta-card'}.png`;
  return { file: new File([blob], name, { type: 'image/png' }), url: urls.createObjectURL(blob), filename: name };
}

export function canShareImage(image, nav = navigator) {
  try { return !!image?.file && typeof nav.share === 'function' && nav.canShare?.({ files: [image.file] }) === true; }
  catch { return false; }
}

// Intentionally synchronous until navigator.share is invoked. Rendering or
// awaiting anything here can consume Safari's transient user activation.
export function sharePreparedImage(image, nav = navigator) {
  if (!canShareImage(image, nav)) throw new Error('File sharing is unavailable.');
  return nav.share({ files: [image.file] });
}

export function releaseBrowserShareImage(image, urls = URL, schedule = setTimeout) {
  // Let a download or newly opened image finish loading after the sheet closes.
  if (image?.url && !image.released) {
    image.released = true;
    schedule(() => urls.revokeObjectURL(image.url), 60000);
  }
}

export function isShareCancelled(error) {
  return error?.name === 'AbortError' || /cancel/i.test(String(error?.message || ''));
}
