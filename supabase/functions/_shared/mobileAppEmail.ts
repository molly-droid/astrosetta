/** Email-safe app links; uses the public domain so it works outside the browser. */
export function mobileAppEmailSection() {
  return `
  <tr><td style="padding:24px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1E8;border:1px solid #A07C3F33;border-radius:12px;">
      <tr><td style="padding:20px;">
        <h2 style="font-family:Georgia,serif;font-size:18px;line-height:1.4;color:#2C3E50;margin:0 0 12px;">Keep Astrosetta close</h2>
        <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#2C3E50;margin:0 0 10px;"><strong>On Android</strong><br>Download Astrosetta from Google Play:</p>
        <a href="https://play.google.com/store/apps/details?id=com.astrosetta.app" style="display:inline-block;text-decoration:none;"><img src="https://astrosetta.com/brand/google-play-badge-en.png" width="180" height="70" alt="Get Astrosetta on Google Play" style="display:block;border:0;width:180px;max-width:100%;height:auto;"></a>
        <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#2C3E50;margin:18px 0 8px;"><strong>On iPhone</strong><br>Add the browser app to your Home Screen:</p>
        <ol style="font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#2C3E50;margin:0 0 12px;padding-left:22px;">
          <li>Open <a href="https://astrosetta.com" style="color:#84632D;text-decoration:underline;">astrosetta.com</a> in Safari.</li>
          <li>Tap Share. Depending on your Safari layout, open the page menu or More first.</li>
          <li>Scroll to Add to Home Screen, then tap Add. Turn on Open as Web App if that option appears.</li>
        </ol>
        <p style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#8B7355;margin:0;">Sign in with the same email to keep your chart, progress and plan.</p>
      </td></tr>
    </table>
  </td></tr>`;
}
