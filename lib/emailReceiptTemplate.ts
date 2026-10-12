/**
 * Studio Maya — Thermal Receipt HTML Email Template
 * Renders an authentic thermal receipt matching the on-screen physical receipt design.
 * Compatible with Gmail, Apple Mail, Outlook, Yahoo, and mobile email clients.
 */

export interface EmailReceiptItem {
  name: string;
  price: number;
}

export interface EmailDownloadLink {
  productName: string;
  url: string;
  type: 'pdf' | 'template';
}

export interface EmailReceiptOptions {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  dateStr?: string;
  items: EmailReceiptItem[];
  totalAmount: number;
  downloadLinks?: EmailDownloadLink[];
}

export function generateThermalReceiptEmailHtml(options: EmailReceiptOptions): string {
  const {
    orderNumber,
    customerName,
    customerEmail,
    dateStr,
    items,
    totalAmount,
    downloadLinks = [],
  } = options;

  const formattedDate =
    dateStr ||
    new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });

  // Generate item table rows
  const itemRowsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 6px 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #111111; text-align: left;">
          ${item.name}
        </td>
        <td style="padding: 6px 0; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #111111; text-align: right; font-weight: bold; white-space: nowrap;">
          ₹${item.price}
        </td>
      </tr>
    `
    )
    .join('');

  // Generate download buttons
  const buttonsHtml =
    downloadLinks.length > 0
      ? downloadLinks
          .map(
            (link) => `
        <div style="margin-bottom: 12px;">
          <a href="${link.url}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; text-align: center; padding: 14px 20px; background-color: #000000; color: #ffffff; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; font-size: 14px; border-radius: 12px; letter-spacing: 0.5px;">
            ${link.type === 'pdf' ? '📥 Download ' + link.productName + ' (PDF)' : '🔗 Access ' + link.productName + ' (Notion Template)'}
          </a>
        </div>
      `
          )
          .join('')
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Studio Maya Receipt — ${orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5; padding: 30px 12px;">
    <tr>
      <td align="center">
        
        <!-- Main Email Wrapper -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 440px; margin: 0 auto;">
          
          <!-- Top Tagline -->
          <tr>
            <td align="center" style="padding-bottom: 14px;">
              <span style="font-size: 11px; letter-spacing: 1.5px; font-weight: 700; color: #71717a; text-transform: uppercase;">
                Studio Maya • Verified Order Confirmation
              </span>
            </td>
          </tr>

          <!-- Thermal Receipt Body -->
          <tr>
            <td style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); overflow: hidden;">
              
              <!-- Top Receipt Detached Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0;">
                <tr>
                  <td align="center" style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #065f46; letter-spacing: 1px; text-transform: uppercase; font-family: 'Courier New', Courier, monospace;">
                    ✓ RECEIPT DETACHED & SAVED
                  </td>
                </tr>
              </table>

              <!-- Receipt Content Inner -->
              <div style="padding: 28px 24px;">
                
                <!-- Brand Header -->
                <div style="text-align: center; padding-bottom: 16px;">
                  <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 6px auto;">
                    <tr>
                      <td style="width: 20px; height: 20px; background-color: #000000; border-radius: 4px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: 900; font-size: 10px; font-family: sans-serif;">
                        M
                      </td>
                      <td style="padding-left: 8px; font-size: 16px; font-weight: 900; color: #09090b; letter-spacing: 2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        STUDIO MAYA
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0; font-size: 11px; color: #71717a; font-family: 'Courier New', Courier, monospace; letter-spacing: 1.5px; text-transform: uppercase;">
                    VERIFIED DIGITAL RECEIPT
                  </p>
                </div>

                <!-- Meta Details -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #3f3f46;">
                  <tr>
                    <td style="padding: 2px 0; color: #71717a;">ORDER:</td>
                    <td style="padding: 2px 0; text-align: right; font-weight: bold; color: #09090b;">${orderNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0; color: #71717a;">DATE:</td>
                    <td style="padding: 2px 0; text-align: right; color: #09090b;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0; color: #71717a;">BUYER:</td>
                    <td style="padding: 2px 0; text-align: right; font-weight: bold; color: #09090b;">${customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0; color: #71717a;">EMAIL:</td>
                    <td style="padding: 2px 0; text-align: right; color: #09090b;">${customerEmail}</td>
                  </tr>
                </table>

                <!-- Dashed Perforation Line -->
                <div style="border-top: 1px dashed #d4d4d8; margin: 12px 0;"></div>

                <!-- Items Table -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                  <tr>
                    <td style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: bold; color: #71717a; text-transform: uppercase; padding-bottom: 4px; text-align: left;">
                      ITEM DESCRIPTION
                    </td>
                    <td style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: bold; color: #71717a; text-transform: uppercase; padding-bottom: 4px; text-align: right;">
                      AMOUNT
                    </td>
                  </tr>
                  ${itemRowsHtml}
                </table>

                <!-- Dashed Perforation Line -->
                <div style="border-top: 1px dashed #d4d4d8; margin: 12px 0;"></div>

                <!-- Financial Totals -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #3f3f46;">
                  <tr>
                    <td style="padding: 3px 0; color: #52525b;">SUBTOTAL</td>
                    <td style="padding: 3px 0; text-align: right; color: #09090b;">₹${totalAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; color: #52525b;">LAUNCH DISCOUNT</td>
                    <td style="padding: 3px 0; text-align: right; color: #09090b;">-₹0.00</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="border-top: 1px solid #e4e4e7; padding-top: 6px;"></td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-size: 15px; font-weight: 900; color: #09090b;">TOTAL PAID</td>
                    <td style="padding: 4px 0; text-align: right; font-size: 16px; font-weight: 900; color: #09090b;">₹${totalAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; font-size: 11px; font-weight: 700; color: #047857;">PAYMENT STATUS</td>
                    <td style="padding: 3px 0; text-align: right; font-size: 11px; font-weight: 700; color: #047857;">PAID ✓</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; font-size: 11px; color: #71717a;">DELIVERY ACCESS</td>
                    <td style="padding: 3px 0; text-align: right; font-size: 11px; color: #71717a;">INSTANT & LIFETIME</td>
                  </tr>
                </table>

                <!-- Dashed Perforation Line -->
                <div style="border-top: 1px dashed #d4d4d8; margin: 14px 0;"></div>

                <!-- Barcode Graphic -->
                <div style="text-align: center; padding: 6px 0 14px 0;">
                  <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                    <tr>
                      <td style="height: 38px; line-height: 38px;">
                        <!-- Clean HTML Barcode Stripes -->
                        <span style="display: inline-block; width: 3px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 1px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 4px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 1px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 3px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 4px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 1px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 3px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 1px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 4px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 3px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 1px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 4px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                        <span style="display: inline-block; width: 2px; height: 36px; background-color: #000; margin: 0 1px;"></span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 4px 0 0 0; font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #71717a; letter-spacing: 2px;">
                    * ${orderNumber} *
                  </p>
                  <p style="margin: 8px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 800; color: #18181b; letter-spacing: 1px;">
                    WELCOME TO THE STUDIO
                  </p>
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: #a1a1aa; font-family: 'Courier New', Courier, monospace;">
                    Keep this slip for your records
                  </p>
                </div>

                <!-- Instant Download Actions -->
                ${
                  buttonsHtml
                    ? `
                  <div style="margin-top: 18px; padding-top: 18px; border-top: 1px solid #f4f4f5;">
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #09090b; text-align: center;">
                      Your Digital Access Links:
                    </p>
                    ${buttonsHtml}
                  </div>
                `
                    : ''
                }

              </div>
            </td>
          </tr>

          <!-- Footer Notes -->
          <tr>
            <td align="center" style="padding-top: 16px; font-size: 12px; color: #71717a; line-height: 1.6;">
              <p style="margin: 0;">Secure links are active for 7 days. Also saved in your Studio Maya account dashboard.</p>
              <p style="margin: 6px 0 0 0;">Need help? Simply reply directly to this email.</p>
              <p style="margin: 12px 0 0 0; font-size: 11px; color: #a1a1aa;">
                © ${new Date().getFullYear()} Studio Maya. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}
