// Booking on Botanica. Salubrious HQ knows Nicole's hours and Google Calendar,
// holds paid times while the visitor pays right here (Stripe Payment Element), and tells the CRM.
(function () {
  var HQ = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:3300" : "https://salubrious-admin.netlify.app";
  var root = document.getElementById("booking");
  if (!root) return;

  var WHERE = { video: "Video call", phone: "Phone call", office: "In person" };
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var state = { types: [], type: null, slots: null, day: "", time: "", busy: false, error: "", notice: "", done: null, paying: null };
  var testing = new URLSearchParams(location.search).get("test") === "1";
  var stripeJs = null, pay = { stripe: null, elements: null, element: null, ready: false };

  function loadStripe(key) {
    stripeJs = stripeJs || new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = function () { resolve(window.Stripe); };
      s.onerror = function () { stripeJs = null; reject(new Error("The payment form couldn't load. Please check your connection and try again.")); };
      document.head.appendChild(s);
    });
    return stripeJs.then(function (Stripe) { return Stripe(key); });
  }

  var appearance = {
    theme: "stripe",
    variables: { colorPrimary: "#422044", colorBackground: "#fbf8f0", colorText: "#10271b", colorDanger: "#a3271f", fontFamily: "'DM Sans', sans-serif", fontSizeBase: "16px", borderRadius: "10px" },
    rules: { ".Input": { border: "1px solid #cad1c2", boxShadow: "none" }, ".Input:focus": { borderColor: "#422044", boxShadow: "0 0 0 3px #42204422" } }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function price(c) {
    return c ? "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0 }) : "Free";
  }
  function dayKey(iso) {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  }
  function fmtDay(k) {
    return new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  }
  function fmtFull(iso) {
    return new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  }
  function call(path, body) {
    return fetch(HQ + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "Something went wrong. Please try again.");
        return d;
      });
    });
  }

  function loadSlots() {
    state.slots = null;
    render();
    var id = state.type.id;
    call("/api/public/booking/slots?type=" + encodeURIComponent(id))
      .then(function (d) {
        if (!state.type || state.type.id !== id) return;
        state.slots = d.slots;
        state.day = d.slots.length ? dayKey(d.slots[0]) : "";
        render();
      })
      .catch(function (e) { state.error = e.message; render(); });
  }

  function renderPayment() {
    var p = state.paying;
    root.innerHTML =
      '<form class="booking-form booking-pay"><h2 class="booking-step">4. Payment</h2><p class="booking-muted">' + esc(p.booking.typeName) + " · " + esc(fmtFull(p.booking.start)) +
      '</p><p class="booking-muted">We are holding this time for you for 30 minutes.</p><div class="booking-card">' + (pay.ready ? "" : '<p class="booking-muted booking-loading">Loading secure payment form…</p>') +
      '<div id="payment-element"></div></div>' + (state.error ? '<p class="form-status error" role="alert">' + esc(state.error) + "</p>" : "") +
      '<div class="booking-pay-actions"><button class="button" type="submit"' + (state.busy || !pay.ready ? " disabled" : "") + ">" + (state.busy ? "One moment…" : "Pay " + price(p.payment.amount) + " and book") +
      '</button><button type="button" class="booking-back"' + (state.busy ? " disabled" : "") + '>Choose a different time</button></div><p class="booking-muted booking-small">Payments are processed securely by Stripe. Your card details never touch our servers.</p></form>';
    if (pay.element) { pay.element.unmount(); pay.element.mount("#payment-element"); }
  }

  function startPayment(booking, payment) {
    state.paying = { booking: booking, payment: payment };
    state.error = "";
    pay.ready = false;
    renderPayment();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    loadStripe(payment.publishableKey)
      .then(function (stripe) {
        pay.stripe = stripe;
        pay.elements = stripe.elements({ clientSecret: payment.clientSecret, appearance: appearance, fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" }] });
        pay.element = pay.elements.create("payment", { layout: "tabs" });
        pay.element.on("ready", function () {
          pay.ready = true;
          var l = root.querySelector(".booking-loading");
          if (l) l.remove();
          var b = root.querySelector(".booking-pay button[type=submit]");
          if (b && !state.busy) b.disabled = false;
        });
        pay.element.mount("#payment-element");
      })
      .catch(function (e) { state.error = e.message; renderPayment(); });
  }

  function endPayment() {
    if (pay.element) pay.element.destroy();
    pay = { stripe: null, elements: null, element: null, ready: false };
    state.paying = null;
  }

  function setPayBusy(busy) {
    state.busy = busy;
    root.querySelectorAll(".booking-pay button").forEach(function (b) { b.disabled = busy || (b.type === "submit" && !pay.ready); });
    var sub = root.querySelector(".booking-pay button[type=submit]");
    if (sub) sub.textContent = busy ? "One moment…" : "Pay " + price(state.paying.payment.amount) + " and book";
  }

  function showPayError(msg) {
    var old = root.querySelector(".booking-pay .form-status");
    if (old) old.remove();
    if (!msg) return;
    var p = document.createElement("p");
    p.className = "form-status error";
    p.setAttribute("role", "alert");
    p.textContent = msg;
    root.querySelector(".booking-pay-actions").before(p);
  }

  function render() {
    if (state.paying && !state.done) return renderPayment();
    if (state.done) {
      var b = state.done;
      root.innerHTML =
        '<div class="booking-done" role="status"><p class="eyebrow">YOU ARE BOOKED</p><h2>' + esc(b.typeName) + "</h2><p>" + esc(fmtFull(b.start)) + '</p><p class="booking-muted">' +
        b.minutes + " minutes · " + WHERE[b.where] + (b.paid ? " · Paid " + price(b.price) : "") + "</p>" +
        (b.meetLink ? '<a class="button" href="' + esc(b.meetLink) + '">Video call link</a>' : "") +
        '<p class="booking-muted">' + (b.invited ? "A calendar invite is on its way to your email." : "Nicole has your booking and will be in touch.") + "</p></div>";
      return;
    }
    if (!state.types.length && !state.error) {
      root.innerHTML = '<p class="booking-muted">' + (state.loaded ? 'Online booking is not open right now. Please <a href="/contact/?interest=life_strategy#inquiry">send a message</a>.' : "Loading…") + "</p>";
      return;
    }
    var h = "";
    if (state.notice) h += '<p class="booking-notice">' + esc(state.notice) + "</p>";
    h += '<h2 class="booking-step">1. Choose a call</h2><div class="booking-types">';
    state.types.forEach(function (t) {
      var on = state.type && state.type.id === t.id;
      h += '<button type="button" class="booking-type' + (on ? " on" : "") + '" data-type="' + esc(t.id) + '" aria-pressed="' + on + '"><strong>' + esc(t.name) + "</strong><span>" +
        t.minutes + " min · " + WHERE[t.where] + " · " + price(t.price) + "</span>" + (t.description ? "<em>" + esc(t.description) + "</em>" : "") + "</button>";
    });
    h += "</div>";
    if (state.type) {
      h += '<h2 class="booking-step">2. Pick a time</h2><p class="booking-muted">Times are shown in your time zone (' + esc(tz.replace(/_/g, " ")) + ").</p>";
      if (!state.slots) h += '<p class="booking-muted">Finding open times…</p>';
      else if (!state.slots.length) h += '<p class="booking-muted">No open times right now. Please <a href="/contact/?interest=life_strategy#inquiry">send a message</a> and we will find one.</p>';
      else {
        var days = [], byDay = {};
        state.slots.forEach(function (s) {
          var k = dayKey(s);
          if (!byDay[k]) { byDay[k] = []; days.push(k); }
          byDay[k].push(s);
        });
        h += '<div class="booking-days">' + days.map(function (k) {
          return '<button type="button" class="' + (k === state.day ? "on" : "") + '" data-day="' + k + '">' + fmtDay(k) + "</button>";
        }).join("") + '</div><div class="booking-times">' + (byDay[state.day] || []).map(function (s) {
          return '<button type="button" class="' + (s === state.time ? "on" : "") + '" data-time="' + s + '">' + fmtTime(s) + "</button>";
        }).join("") + "</div>";
      }
    }
    if (state.type && state.time) {
      var phone = state.type.where === "phone";
      h += '<form class="booking-form inquiry-form"><h2 class="booking-step">3. Your details</h2><p class="booking-muted">' + esc(state.type.name) + " · " + esc(fmtFull(state.time)) + "</p>" +
        '<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">' +
        '<div class="form-row"><label>Name<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label></div>' +
        "<label><span>Phone " + (phone ? "(Nicole will call you on this number)" : '<span class="optional">(optional)</span>') + '</span><input name="phone" type="tel" autocomplete="tel"' + (phone ? " required" : "") + "></label>" +
        '<label><span>Anything you would like Nicole to know? <span class="optional">(optional)</span></span><textarea name="note" rows="3"></textarea></label>' +
        (state.error ? '<p class="form-status error" role="alert">' + esc(state.error) + "</p>" : "") +
        '<button class="button" type="submit"' + (state.busy ? " disabled" : "") + ">" + (state.busy ? "One moment…" : state.type.price ? "Continue to payment · " + price(state.type.price) : "Confirm booking") + "</button></form>";
    } else if (state.error) h += '<p class="form-status error" role="alert">' + esc(state.error) + "</p>";
    root.innerHTML = h;
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.type === "submit") return;
    if (b.classList.contains("booking-back")) {
      var p = state.paying;
      setPayBusy(true);
      call("/api/public/booking/return", { booking: p.booking.id, paymentIntent: p.payment.clientSecret.split("_secret_")[0], cancelled: true })
        .catch(function () {})
        .then(function () {
          endPayment();
          state.busy = false;
          state.time = "";
          state.notice = "That time has been released. Choose another below.";
          loadSlots();
        });
      return;
    }
    if (b.dataset.type) {
      state.type = state.types.filter(function (t) { return t.id === b.dataset.type; })[0];
      state.time = "";
      state.error = "";
      loadSlots();
    } else if (b.dataset.day) {
      state.day = b.dataset.day;
      state.time = "";
      render();
    } else if (b.dataset.time) {
      state.time = b.dataset.time;
      state.error = "";
      render();
      var f = root.querySelector(".booking-form");
      if (f) f.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  root.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.paying) return submitPayment();
    var f = e.target, v = function (n) { return f.elements[n] ? f.elements[n].value : ""; };
    var draft = { name: v("name"), email: v("email"), phone: v("phone"), note: v("note") };
    state.busy = true;
    state.error = "";
    render();
    call("/api/public/booking", { typeId: state.type.id, start: state.time, name: draft.name, email: draft.email, phone: draft.phone, note: draft.note, company: v("company") })
      .then(function (d) {
        state.busy = false;
        if (d.payment) return startPayment(d.booking, d.payment);
        state.done = d.booking;
        render();
      })
      .catch(function (err) {
        state.busy = false;
        state.error = err.message;
        state.time = "";
        loadSlots();
      });
  });

  function submitPayment() {
    var p = state.paying;
    if (!pay.stripe || !pay.ready || state.busy) return;
    setPayBusy(true);
    showPayError("");
    pay.stripe
      .confirmPayment({ elements: pay.elements, redirect: "if_required", confirmParams: { return_url: location.origin + "/book/" } })
      .then(function (r) {
        if (r.error) throw new Error(r.error.message || "Your payment didn't go through. Please try again.");
        return call("/api/public/booking/return", { booking: p.booking.id, paymentIntent: p.payment.clientSecret.split("_secret_")[0] });
      })
      .then(function (d) {
        if (d.booking.status !== "confirmed") throw new Error("Your payment went through and we're confirming it now. You'll get an email shortly.");
        endPayment();
        state.busy = false;
        state.done = d.booking;
        render();
      })
      .catch(function (err) {
        setPayBusy(false);
        showPayError(err.message);
      });
  }

  call("/api/public/booking/types?site=botanica" + (testing ? "&test=1" : ""))
    .then(function (d) {
      state.types = d.types;
      state.loaded = true;
      if (d.types.length === 1) { state.type = d.types[0]; loadSlots(); }
      else render();
    })
    .catch(function (e) { state.error = e.message; state.loaded = true; render(); });
})();
