type PrintResponse = {
  html?: string;
  url?: string;
  publicPath?: string;
  signedUrl?: string;
};

/**
 * Opens an invoice preview in a new tab.
 * Opens the window synchronously (before await) so browsers do not block it.
 */
export async function openInvoicePrint(
  fetchPrint: () => Promise<PrintResponse>,
): Promise<void> {
  const preview = window.open('about:blank', '_blank');
  if (preview) {
    preview.document.write(
      '<!DOCTYPE html><title>Preparing invoice…</title><body style="font-family:sans-serif;padding:24px">Preparing invoice preview…</body>',
    );
    preview.document.close();
  }

  try {
    const res = await fetchPrint();
    const pdfUrl = res.signedUrl || res.publicPath || res.url;

    if (res.html) {
      if (preview && !preview.closed) {
        preview.document.open();
        preview.document.write(withPrintChrome(res.html));
        preview.document.close();
        preview.focus();
        return;
      }
      // Popup blocked — fall through to PDF / same-tab open
    }

    if (pdfUrl) {
      if (preview && !preview.closed) {
        preview.location.href = pdfUrl;
        return;
      }
      window.open(pdfUrl, '_blank');
      return;
    }

    if (preview && !preview.closed) preview.close();
    throw new Error('Print succeeded but no preview was returned');
  } catch (err) {
    if (preview && !preview.closed) preview.close();
    throw err;
  }
}

export function withPrintChrome(html: string): string {
  const toolbar = `
<style>
  @media print { .no-print { display: none !important; } }
  .no-print {
    position: sticky; top: 0; z-index: 10;
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 10px 16px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb;
    font-family: system-ui, sans-serif;
  }
  .no-print button {
    appearance: none; border: 0; border-radius: 6px; padding: 8px 14px;
    background: #0f4c81; color: #fff; font-weight: 600; cursor: pointer;
  }
  .no-print button.secondary { background: #374151; }
</style>
<div class="no-print">
  <button type="button" onclick="window.print()">Print</button>
  <button type="button" class="secondary" onclick="window.close()">Close</button>
</div>`;

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
  }
  return toolbar + html;
}
