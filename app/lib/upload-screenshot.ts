export async function uploadScreenshot(file: File): Promise<string> {
  const signRes = await fetch('/api/edit/screenshot-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  const sign = await signRes.json();
  if (!signRes.ok) {
    throw new Error(sign.error || `Failed to get upload URL: ${signRes.status}`);
  }

  const putRes = await fetch(sign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new Error(`Screenshot upload failed: ${putRes.status} ${text}`);
  }

  return sign.publicUrl as string;
}
