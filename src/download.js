// Saves a fetch Response as a file, preferring the server's filename when it is readable.
export async function saveResponse(res, fallbackName) {
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

export function saveBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
