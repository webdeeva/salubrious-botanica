// Booking on Botanica. Salubrious HQ knows Nicole's hours and Google Calendar,
// holds paid times during Stripe checkout, and tells the CRM.
(function () {
  var HQ = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:3300" : "https://salubrious-admin.netlify.app";
  var root = document.getElementById("booking");
  if (!root) return;

  var WHERE = { video: "Video call", phone: "Phone call", office: "In person" };
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var state = { types: [], type: null, slots: null, day: "", time: "", busy: false, error: "", notice: "", done: null };

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

  function render() {
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
    var f = e.target, v = function (n) { return f.elements[n] ? f.elements[n].value : ""; };
    var draft = { name: v("name"), email: v("email"), phone: v("phone"), note: v("note") };
    state.busy = true;
    state.error = "";
    render();
    call("/api/public/booking", { typeId: state.type.id, start: state.time, name: draft.name, email: draft.email, phone: draft.phone, note: draft.note, company: v("company") })
      .then(function (d) {
        if (d.checkoutUrl) { location.href = d.checkoutUrl; return; }
        state.busy = false;
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

  // Back from Stripe checkout?
  var q = new URLSearchParams(location.search);
  var back = q.get("booking")
    ? call("/api/public/booking/return", { booking: q.get("booking"), sessionId: q.get("session_id") || "", cancelled: q.get("cancelled") === "1" })
        .then(function (d) {
          if (d.booking.status === "confirmed") state.done = d.booking;
          else state.notice = q.get("cancelled") === "1" ? "Payment was cancelled, so that time was not booked. You can choose again below." : "We are still waiting on your payment. If you completed it, you will get an email shortly.";
        })
        .catch(function (e) { state.notice = e.message; })
        .then(function () { history.replaceState(null, "", location.pathname); })
    : Promise.resolve();

  back.then(function () {
    if (state.done) return render();
    call("/api/public/booking/types?site=botanica")
      .then(function (d) {
        state.types = d.types;
        state.loaded = true;
        if (d.types.length === 1) { state.type = d.types[0]; loadSlots(); }
        else render();
      })
      .catch(function (e) { state.error = e.message; state.loaded = true; render(); });
  });
})();
