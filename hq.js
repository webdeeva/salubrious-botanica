// Connects the Botanica site to Salubrious HQ: form submissions become leads
// (and CRM contacts), and a cookie-free page-view counter.
(function () {
  var HQ = "https://salubrious-admin.netlify.app";

  var s = document.createElement("script");
  s.src = HQ + "/t.js";
  s.defer = true;
  s.setAttribute("data-site", "botanica");
  document.head.appendChild(s);

  // Preselect the inquiry type from ?interest= (Life Strategy and Wellness pages link here).
  var interest = new URLSearchParams(location.search).get("interest");
  var select = document.querySelector('form[data-hq-form] select[name="type"]');
  if (interest && select && select.querySelector('option[value="' + interest + '"]')) select.value = interest;

  document.querySelectorAll("form[data-hq-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      var data = Object.fromEntries(new FormData(form).entries());
      data.site = "botanica";
      data.type = data.type || form.getAttribute("data-hq-form");
      data.page = location.pathname;
      // Extra questions (fields with data-label) are folded into the message HQ stores.
      var answers = [];
      form.querySelectorAll("[data-label]").forEach(function (field) {
        var value = (data[field.name] || "").trim();
        delete data[field.name];
        if (value) answers.push(field.getAttribute("data-label") + ":\n" + value);
      });
      if (answers.length) data.message = answers.concat(data.message ? [data.message] : []).join("\n\n");
      button.disabled = true;
      status.textContent = "Sending…";
      status.className = "form-status";
      fetch(HQ + "/api/public/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
            return body;
          });
        })
        .then(function (body) {
          form.reset();
          status.textContent = form.getAttribute("data-success") || body.message || "Thank you.";
          status.className = "form-status ok";
        })
        .catch(function (err) {
          status.textContent = err.message || "We couldn't send that. Please try again, or email us.";
          status.className = "form-status error";
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  });
})();
