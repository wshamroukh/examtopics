export function replaceImgPlaceholders(
  text: string,
  images: string[]
): string {
  if (images.length === 0) {
    return text.replace(/\n/g, "<br/>");
  }

  const toLocalThenRemoteImgTag = (url: string) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === 'img.examtopics.com' ||
        parsed.hostname === 'www.examtopics.com'
      ) {
        const localSrc = parsed.pathname;
        return `<img src="/img${localSrc}" onerror="this.onerror=null;this.src='${url}'" style="max-width:100%; height:auto; margin:10px 0;" />`;
      }
    } catch (_) {}
    return `<img src="${url}" style="max-width:100%; height:auto; margin:10px 0;" />`;
  };

  let processedText = text;

  if (text.includes("//IMG//")) {
    // Has placeholders — replace them in order
    images.forEach((url) => {
      processedText = processedText.replace("//IMG//", toLocalThenRemoteImgTag(url));
    });
  } else {
    // No placeholders — append all images at the end of the text
    const imgTags = images.map(toLocalThenRemoteImgTag).join("\n");
    processedText = processedText + "\n" + imgTags;
  }

  return processedText.replace(/\n/g, "<br/>");
}
