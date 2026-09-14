import { sendDigestEmail } from "./resendEmail.ts";

/**
 * Event Signup & Incentive Tracking — shared helpers used by
 * createCheckoutSession (validates the event payload and stamps it onto the
 * Stripe session metadata) and stripeWebhook (creates the EventOrder,
 * decrements stock race-safely, and notifies the booth team by email).
 * Reusable across pop-ups: every event is a PopupEvent record, never code.
 */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function safeParseJson(str) {
  try {
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}

/**
 * Validates an event signup payload and returns { event, sku }.
 * Throws Error with a user-safe message when invalid.
 */
export async function resolveEventSignup(base44, eventSignup) {
  const events = await base44.asServiceRole.entities.PopupEvent.filter({ event_id: eventSignup.event_id });
  const event = events?.[0];
  if (!event) throw new Error("This event could not be found");

  const isPromo = eventSignup.signup_channel === "promo_code";
  const today = todayStr();

  if (isPromo) {
    if (String(event.promo_code || "").toUpperCase() !== String(eventSignup.promo_code || "").toUpperCase()) {
      throw new Error("That promo code is not valid for this event");
    }
    if (event.promo_valid_until < today) throw new Error("That promo code has expired");
    const shipping = eventSignup.shipping_address || {};
    if (!shipping.name || !shipping.line1 || !shipping.city || !shipping.state || !shipping.zip) {
      throw new Error("A full shipping address is required for mailed gifts");
    }
  } else {
    // QR-tagged booth signups stay valid through the event day (+1 day buffer
    // for late-night signups); after that the promo code is the intended path.
    if (!event.is_active) throw new Error("This event is not accepting signups");
    const cutoff = new Date(new Date(event.end_date + "T00:00:00Z").getTime() + 2 * 86400000).toISOString().slice(0, 10);
    if (today > cutoff) throw new Error("This event has ended — use the event promo code instead");
  }

  const skus = await base44.asServiceRole.entities.IncentiveSKU.filter({ event_id: event.event_id });
  const sku = (skus || []).find((s) => s.sku_id === eventSignup.sku_id);
  if (!sku) throw new Error("That gift is not available at this event");
  if (isPromo !== !!sku.is_remote) {
    throw new Error(isPromo ? "That gift must be picked up in person" : "That gift is only available by mail");
  }

  return { event, sku };
}

/**
 * Builds the Stripe session metadata for an event signup.
 * Every value must be a string; shipping JSON is capped well under Stripe's
 * 500-char per-value limit.
 */
export function buildEventMetadata(eventSignup, event, sku) {
  return {
    event_id: event.event_id,
    sku_id: sku.sku_id,
    event_first_name: String(eventSignup.first_name || "Friend").slice(0, 40),
    event_channel: eventSignup.signup_channel === "promo_code" ? "promo_code" : "qr_link",
    event_shipping:
      eventSignup.signup_channel === "promo_code"
        ? JSON.stringify(eventSignup.shipping_address || {}).slice(0, 480)
        : "",
    event_gift_sold_out: String((sku.stock_remaining || 0) <= 0),
  };
}

/**
 * Called from stripeWebhook on checkout.session.completed for event-tagged
 * sessions: creates the EventOrder, decrements stock race-safely, and emails
 * the booth team. Failures here never roll back the subscription itself.
 */
export async function createEventOrder(base44, session) {
  const m = session.metadata;
  const tier = m.tier === "calendar" ? "premium" : "core";
  const period = m.period === "yearly" ? "yearly" : "monthly";
  const remote = m.event_channel === "promo_code";
  const userId = m.base44_user_id;

  const skus = await base44.asServiceRole.entities.IncentiveSKU.filter({ sku_id: m.sku_id });
  const sku = skus?.[0];

  // Race-safe stock decrement: the $gt guard only succeeds while stock is
  // positive, so concurrent orders can never oversell the last piece.
  let soldOut = m.event_gift_sold_out === "true";
  if (sku && !soldOut) {
    const dec = await base44.asServiceRole.entities.IncentiveSKU.updateMany(
      { sku_id: sku.sku_id, stock_remaining: { $gt: 0 } },
      { $inc: { stock_remaining: -1 } }
    );
    soldOut = !dec || !(dec.updated > 0);
  }

  // Big 3 from the user's latest natal chart — Premium confirmations show all three
  let sunSign = "";
  let moonSign = "";
  let risingSign = "";
  try {
    const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: userId }, "-created_date", 3);
    const chart = charts?.[0];
    if (chart) {
      sunSign = chart.sun_sign || "";
      moonSign = chart.moon_sign || "";
      risingSign = chart.ascendant_sign || "";
    }
  } catch (e) {
    console.error("Event order chart lookup failed:", e.message);
  }

  const pickupStatus = remote ? "remote_fulfillment" : tier === "premium" ? "pending" : "ready";
  const order = await base44.asServiceRole.entities.EventOrder.create({
    user_id: userId,
    event_id: m.event_id,
    first_name: m.event_first_name || "Friend",
    sku_id: m.sku_id,
    tier,
    billing_cycle: period,
    item_type: sku?.item_type || "gift",
    metal: sku?.metal || null,
    pickup_status: pickupStatus,
    signup_channel: remote ? "promo_code" : "qr_link",
    remote,
    sold_out: soldOut,
    shipping_address: remote ? safeParseJson(m.event_shipping) : null,
    sun_sign: sunSign,
    moon_sign: tier === "premium" ? moonSign : "",
    rising_sign: tier === "premium" ? risingSign : "",
  });

  // Booth team notification — failures never break the order itself
  try {
    const events = await base44.asServiceRole.entities.PopupEvent.filter({ event_id: m.event_id });
    const event = events?.[0];
    if (event?.notify_email) {
      const big3 = tier === "premium" ? `${sunSign || "—"} / ${moonSign || "—"} / ${risingSign || "—"}` : sunSign || "—";
      const item = [sku?.metal, sku?.item_type].filter(Boolean).join(" ") || "event gift";
      const status = remote ? "MAIL TO BUYER" : tier === "premium" ? "CUSTOM BUILD" : "READY AT BOOTH";
      const address = remote ? safeParseJson(m.event_shipping) : null;
      await sendDigestEmail({
        to: event.notify_email,
        subject: `✦ ${event.event_name} order — ${m.event_first_name || "Friend"} (${tier === "premium" ? "Premium" : "Core"} ${period})`,
        html: `<div style="font-family:Georgia,serif;color:#2C3E50;background:#FDFBF7;padding:24px;border-radius:12px;">
          <p style="color:#C9A961;letter-spacing:1px;font-size:11px;text-transform:uppercase;margin:0 0 4px;">${event.event_name} — new signup</p>
          <p style="font-size:20px;margin:0 0 12px;"><strong>${m.event_first_name || "Friend"}</strong> &middot; ${tier === "premium" ? "Premium" : "Core"} ${period}</p>
          <table style="font-size:14px;line-height:1.7;">
            <tr><td style="color:#8B7355;padding-right:12px;">Chart</td><td>${big3}</td></tr>
            <tr><td style="color:#8B7355;padding-right:12px;">Gift</td><td>${item}${soldOut ? " — <strong>SOLD OUT, mail when restocked</strong>" : ""}</td></tr>
            <tr><td style="color:#8B7355;padding-right:12px;">Status</td><td><strong>${status}</strong></td></tr>
            ${address ? `<tr><td style="color:#8B7355;padding-right:12px;">Ship to</td><td>${address.name || ""} — ${address.line1 || ""}, ${address.city || ""} ${address.state || ""} ${address.zip || ""}</td></tr>` : ""}
          </table>
          <p style="font-size:12px;color:#8B7355;margin-top:14px;">Open the Booth Queue in the admin panel to mark this order picked up.</p>
        </div>`,
      });
      await base44.asServiceRole.entities.EventOrder.update(order.id, {
        fulfillment_notified_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("Event order notification failed:", e.message);
  }

  console.log(`Event order created: user=${userId} event=${m.event_id} tier=${tier} ${period} status=${pickupStatus} soldOut=${soldOut}`);
  return order;
}