const navToggle = document.querySelector("#main-nav-toggle");
const navLinks = document.querySelector("#main-nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";

    navToggle.setAttribute("aria-expanded", String(!expanded));
    navLinks.hidden = expanded;
  });

  navLinks.addEventListener("click", (event) => {
    if (!event.target.matches("a")) return;

    if (window.matchMedia("(max-width: 40rem)").matches) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.hidden = true;
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 40rem)").matches) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.hidden = false;
    } else {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.hidden = true;
    }
  });
}
