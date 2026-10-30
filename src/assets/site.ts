// Underlines the nav link for the section currently on screen.
const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]')];

if (links.length && "IntersectionObserver" in window) {
  const byId = new Map(links.map((a) => [(a.getAttribute("href") ?? "").slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = byId.get(entry.target.id);
      if (!link) continue;
      if (entry.isIntersecting) {
        for (const a of links) a.removeAttribute("aria-current");
        link.setAttribute("aria-current", "true");
      } else {
        // Scrolled back into the hero: no section is current.
        link.removeAttribute("aria-current");
      }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });

  for (const id of byId.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

export {};
