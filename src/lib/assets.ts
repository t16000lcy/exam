function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, '');
}

export function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${trimTrailingSlash(baseUrl)}/${trimLeadingSlash(path)}`;
}

export function getQuestionDataUrl(slug: string) {
  const externalBaseUrl = (import.meta.env.VITE_QUESTION_DATA_BASE_URL as string | undefined)?.trim();
  if (externalBaseUrl) {
    return joinUrl(externalBaseUrl, `${slug}.json`);
  }
  return `${import.meta.env.BASE_URL}data/questions/${slug}.json`;
}

export function getQuestionAssetUrl(path: string) {
  const externalBaseUrl = (import.meta.env.VITE_QUESTION_ASSET_BASE_URL as string | undefined)?.trim();
  if (externalBaseUrl) {
    return joinUrl(externalBaseUrl, path);
  }
  return `${import.meta.env.BASE_URL}${trimLeadingSlash(path)}`;
}
