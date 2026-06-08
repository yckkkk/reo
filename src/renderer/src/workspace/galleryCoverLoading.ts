export function galleryCoverImageMatchesCurrentSource(image: HTMLImageElement, coverSrc: string) {
  if (image.dataset['galleryCoverLoaded'] !== 'true') {
    return false;
  }
  if (image.getAttribute('src') === coverSrc) {
    return true;
  }
  try {
    const absoluteCoverSrc = new URL(coverSrc, window.location.href).href;
    return image.currentSrc === absoluteCoverSrc || image.src === absoluteCoverSrc;
  } catch {
    return image.currentSrc === coverSrc || image.src === coverSrc;
  }
}

export function shouldLoadGalleryCoverImage(image: HTMLImageElement) {
  const coverSrc = image.dataset['galleryCoverSrc'];
  return Boolean(coverSrc && !galleryCoverImageMatchesCurrentSource(image, coverSrc));
}
