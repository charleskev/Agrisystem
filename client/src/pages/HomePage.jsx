import { useEffect, useState } from "react";

const imageSources = {
  hero: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=86",
  harvest: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=84",
  farmer: "/images/rice-farmer.jpg",
  seedling: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1000&q=84",
  field: "https://images.unsplash.com/photo-1472141521881-95d0e87e2e39?auto=format&fit=crop&w=1200&q=84",
  soil: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=84",
};

const trustItems = [
  ["records", "Organized Farm Records", "Keep land, crop, and farm information together."],
  ["map", "Farm Location Mapping", "Save a farm pin or boundary when needed."],
  ["report", "Crop Damage Documentation", "Send incident details and photos for review."],
  ["updates", "MAO Service Updates", "Review notices and report progress in the portal."],
];

const services = [
  ["records", "Farm Records", "Organize available farm details, crop information, and land records.", "image", imageSources.harvest],
  ["map", "Farm Mapping", "Mark farm boundaries and review estimated area and perimeter.", "plain"],
  ["report", "Crop Damage Reporting", "Submit crop damage details and photographs for authorized staff review.", "plain"],
  ["updates", "Agricultural Updates", "View available announcements and follow report status updates.", "image", imageSources.field],
  ["weather", "Weather Information", "Review current weather information available through the farmer portal.", "plain"],
  ["scan", "Crop Scanning", "Save crop scans for reference before preparing a report when needed.", "plain"],
];

const highlights = [
  ["records", "Farm information management", "Keep essential farm details available when you need them."],
  ["map", "Farm boundary mapping", "Document a location pin or map a farm boundary."],
  ["report", "Damage documentation", "Provide clear details and photos for staff review."],
  ["updates", "Agricultural updates", "Check available notices and report updates in one place."],
];

const steps = [
  ["01", "Create an account", "Register through the existing farmer registration flow."],
  ["02", "Manage farm information", "Enter farm details and map the farm when applicable."],
  ["03", "Submit and follow up", "Submit supported reports and review available updates."],
];

const questions = [
  ["What is AgriSystem?", "AgriSystem is the Bongabong Municipal Agriculture Office portal. It brings farmer information, farm records, mapping, crop damage reports, and in-portal updates together."],
  ["Who can use the portal?", "Farmers can create a farmer account. MAO staff and administrators use authorized accounts to review farm information, registrations, and reports."],
  ["How do I register as a farmer?", "Choose Create account and complete the requested contact, address, and first farm details. Your registration status is shown in the portal."],
  ["How can I map my farm?", "Open Farm Mapping after signing in to draw or update a boundary. Review and confirm the location details before saving."],
  ["How can I submit a crop damage report?", "After signing in, select a saved farm, enter the crop and damage details, and attach a photo or saved crop scan. You can then follow the report in My Reports."],
  ["How can I view available agricultural updates?", "Sign in to check notifications and report updates. Available announcements are shown in the portal."],
];

export function HomePage() {
  const [openQuestion, setOpenQuestion] = useState(0);

  useEffect(() => {
    const root = document.querySelector(".home-screen");
    const items = root?.querySelectorAll("[data-reveal]");
    if (!root || !items?.length || !("IntersectionObserver" in window)) return;

    root.classList.add("home-motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -28px 0px" });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <div className="home-screen min-h-screen">
    <a className="home-skip-link" href="#main-content">Skip to content</a>

    <section id="home" className="home-hero">
      <Header />
      <div className="home-hero-backdrop" aria-hidden="true" />
      <div className="home-hero-inner mx-auto grid w-full max-w-[1480px] items-center gap-10 px-5 py-12 sm:py-14 lg:min-h-[530px] lg:grid-cols-[.96fr_1.04fr] lg:gap-16 lg:py-12">
        <div className="home-hero-copy relative z-10" data-reveal>
          <p className="home-hero-eyebrow">Agricultural services <span aria-hidden="true">&middot;</span> Bongabong, Oriental Mindoro</p>
          <h1>Your Farm Information. <em>Better Agricultural</em> Services.</h1>
          <p className="home-hero-description">AgriSystem brings farmer information, agricultural reports, and available municipal agriculture services together in one convenient platform for Bongabong, Oriental Mindoro.</p>
          <div className="home-hero-actions">
            <a href="#services" className="home-gold-button">Explore Services <span aria-hidden="true">&rarr;</span></a>
            <a href="#register" className="home-hero-link">Get Started <span aria-hidden="true">&rarr;</span></a>
          </div>
          <div className="home-hero-tags" aria-label="Portal features"><span><i><Icon name="records" /></i>Farmer Information</span><span><i><Icon name="records" /></i>Farm Records</span><span><i><Icon name="report" /></i>Agricultural Reports</span></div>
        </div>

        <div className="home-hero-inset" data-reveal>
          <Image src={imageSources.farmer} fallback="/images/farm-hero.svg" alt="Farmer planting rice seedlings in a green paddy field" />
          <div className="home-inset-label"><Icon name="records" /><span><strong>Farm Information</strong><small>Farmer profiles, farm details, and agricultural records</small></span><b aria-hidden="true">&rarr;</b></div>
          <div className="home-hero-float-card" aria-hidden="true"><span className="home-hero-float-icon"><Icon name="map" /></span><span><strong>Farm Mapping</strong><small>Location and boundaries</small></span><b>&rarr;</b></div>
        </div>
      </div>
    </section>

    <main id="main-content">
      <section className="home-trust-strip" aria-label="Portal capabilities">
        <div className="mx-auto grid max-w-[1480px] px-5 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map(([icon, title, description], index) => <article className="home-trust-item" key={title} data-reveal style={{ "--reveal-delay": `${index * 55}ms` }}>
            <span className="home-trust-icon"><Icon name={icon} /></span><span><strong>{title}</strong><small>{description}</small></span>
          </article>)}
        </div>
      </section>

      <section id="about" className="home-heritage-section scroll-mt-20">
        <div className="home-heritage-grid mx-auto grid max-w-[1480px] items-center gap-9 px-5 py-16 sm:py-20 lg:grid-cols-[1fr_.85fr_1fr] lg:gap-12">
          <div className="home-heritage-photo home-heritage-photo-left" data-reveal><Image src={imageSources.farmer} fallback="/images/farm-dashboard.svg" alt="Farmer working among young rice seedlings" /></div>
          <div className="home-heritage-copy" data-reveal><p className="home-section-eyebrow">Bongabong, Oriental Mindoro</p><h2>Rooted in Bongabong&apos;s agricultural heritage.</h2><p>Bringing essential farm information and available agricultural services together to support local farmers and their communities.</p><a href="#services" className="home-text-link">Explore portal services <span aria-hidden="true">&rarr;</span></a></div>
          <div className="home-heritage-photo home-heritage-photo-right" data-reveal><Image src={imageSources.field} fallback="/images/farm-hero.svg" alt="A cultivated agricultural field" /></div>
        </div>
      </section>

      <section id="services" className="home-services-section scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20">
          <div className="home-services-heading" data-reveal><p className="home-section-eyebrow">Available through the portal</p><h2>Supporting smarter growth for farmers and agri-businesses.</h2><p>Explore the agricultural information and services available through the AgriSystem portal.</p></div>
          <div className="home-service-grid mt-10">
            {services.map(([icon, title, description, kind, source], index) => <article className={`home-service-card home-service-card-${kind}`} key={title} data-reveal style={{ "--reveal-delay": `${index * 65}ms` }}>
              {kind === "image" && <Image src={source} fallback="/images/farm-dashboard.svg" alt="Agricultural work in the field" />}
              <div className="home-service-card-content"><span className="home-service-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section id="features" className="home-feature-section scroll-mt-20">
        <div className="home-feature-grid mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
          <div className="home-feature-copy" data-reveal><p className="home-section-eyebrow">Designed for local farm services</p><h2>The smarter choice for Bongabong&apos;s farmers.</h2><p>Keep essential farm information organized, document agricultural concerns, and access available services through one convenient platform.</p><a href="#register" className="home-primary-button">Get started <span aria-hidden="true">&rarr;</span></a></div>
          <div className="home-feature-image" data-reveal><Image src={imageSources.soil} fallback="/images/farm-hero.svg" alt="Young crops growing in cultivated soil" /></div>
        </div>
      </section>

      <section className="home-highlights-section" aria-label="Farmer portal highlights">
        <div className="mx-auto grid max-w-7xl gap-x-6 gap-y-8 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map(([icon, title, description], index) => <article className="home-highlight-item" key={title} data-reveal style={{ "--reveal-delay": `${index * 55}ms` }}><span className="home-highlight-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section id="how-it-works" className="home-how-section scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
          <div className="home-how-copy" data-reveal><p className="home-section-eyebrow">How it works</p><h2>Clear steps from registration to follow-up.</h2><p>Use the portal at your own pace to keep important farm information in one place.</p></div>
          <ol className="home-steps-list">
            {steps.map(([number, title, description], index) => <li className="home-step" key={number} data-reveal style={{ "--reveal-delay": `${index * 80}ms` }}><span className="home-step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="home-step-connector" aria-hidden="true" /></li>)}
          </ol>
        </div>
      </section>

      <section className="home-community-section">
        <div className="home-community-grid mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:py-20 lg:grid-cols-[1.12fr_.88fr] lg:gap-14">
          <div className="home-community-images" data-reveal><div className="home-community-main"><Image src={imageSources.hero} fallback="/images/farm-dashboard.svg" alt="Green agricultural fields under daylight" /></div><div className="home-community-small"><Image src={imageSources.harvest} fallback="/images/farm-hero.svg" alt="Fresh vegetables from a harvest" /></div></div>
          <div className="home-community-copy" data-reveal><p className="home-section-eyebrow">Together for local agriculture</p><h2>Supporting farmers, strengthening communities.</h2><p>AgriSystem brings farm information and agricultural services together, supporting clearer communication between farmers and the Municipal Agriculture Office.</p></div>
        </div>
      </section>

      <section className="home-faq-section">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
          <div className="home-faq-copy" data-reveal><p className="home-section-eyebrow">Frequently asked questions</p><h2>Good to know before you begin.</h2><p>Find a quick answer about using the AgriSystem portal.</p></div>
          <div className="home-faq-list" data-reveal>
            {questions.map(([question, answer], index) => <article className={`home-faq-item ${openQuestion === index ? "is-open" : ""}`} key={question}><h3><button type="button" id={`home-faq-trigger-${index}`} className="home-faq-trigger" aria-expanded={openQuestion === index} aria-controls={`home-faq-panel-${index}`} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)}><span>{question}</span><span className="home-faq-plus" aria-hidden="true" /></button></h3><div className="home-faq-panel" id={`home-faq-panel-${index}`} role="region" aria-labelledby={`home-faq-trigger-${index}`} aria-hidden={openQuestion !== index}><div className="home-faq-answer"><p>{answer}</p></div></div></article>)}
          </div>
        </div>
      </section>

      <section className="home-cta-section">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16"><div className="home-cta-panel" data-reveal><div><p>AgriSystem &middot; Bongabong</p><h2>Ready to get started?</h2><span>Bring your farm information and available agricultural services together in one convenient place.</span></div><div className="home-cta-actions"><a href="#register" className="home-cta-primary">Create farmer account</a><a href="#login" className="home-cta-secondary">Sign in</a></div></div></div>
      </section>
    </main>

    <footer className="home-footer">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-[1fr_auto] sm:items-center"><a href="#home" className="home-footer-brand flex items-center gap-3" aria-label="AgriSystem home"><img src="/icons/agrisystem-icon.svg" alt="" /><span><strong>AgriSystem</strong><small>Bongabong Municipal Agriculture Office</small></span></a><nav className="home-footer-links flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer navigation"><a href="#home">Home</a><a href="#services">Services</a><a href="#how-it-works">How it works</a><a href="#login">Sign in</a><a href="#register">Create account</a></nav><p className="home-copyright sm:col-span-2">&copy; {new Date().getFullYear()} Bongabong Municipal Agriculture Office. All rights reserved.</p></div>
    </footer>
  </div>;
}

function Header() {
  return <header className="home-header"><div className="home-header-inner mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5"><a href="#home" className="home-brand flex min-w-0 items-center gap-3" aria-label="AgriSystem home"><img src="/icons/agrisystem-icon.svg" alt="" /><span><strong>AgriSystem</strong><small>Bongabong Municipal Agriculture Office</small></span></a><nav className="home-nav-links" aria-label="Public navigation"><a className="is-active" href="#home" aria-current="page">Home</a><a href="#services">Services</a><a href="#features">Features</a><a href="#about">About</a></nav><div className="home-auth-links"><a href="#login">Sign in</a><a href="#register">Create account</a></div><details className="home-mobile-menu"><summary aria-label="Open navigation menu"><span /><span /><span /></summary><nav aria-label="Mobile navigation"><a href="#home">Home</a><a href="#services">Services</a><a href="#features">Features</a><a href="#about">About</a><a href="#login">Sign in</a><a className="home-mobile-register" href="#register">Create account</a></nav></details></div></header>;
}

function Image({ src, fallback, alt }) {
  return <img src={src} alt={alt} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallback; }} />;
}

function Icon({ name }) {
  const paths = {
    records: <><path d="M7 4.75h7.5l3.75 3.75v10.75A1.75 1.75 0 0 1 16.5 21h-9A1.75 1.75 0 0 1 5.75 19.25v-12A2.5 2.5 0 0 1 8.25 4.75Z" /><path d="M14.5 5v4h4M9 13h6M9 16.5h6" /></>,
    map: <><path d="m3.75 6.25 5.5-2 5.5 2 5.5-2v13.5l-5.5 2-5.5-2-5.5 2V6.25Z" /><path d="M9.25 4.5v13.25M14.75 6.25V20M12 8.4c1.55 0 2.7 1.2 2.7 2.65 0 2.05-2.7 4.8-2.7 4.8s-2.7-2.75-2.7-4.8C9.3 9.6 10.45 8.4 12 8.4Z" /><circle cx="12" cy="11" r=".65" fill="currentColor" stroke="none" /></>,
    report: <><path d="M12 3.5 21 19H3l9-15.5Z" /><path d="M12 9v4.5M12 16.5h.01" /></>,
    updates: <><path d="M18 8a6 6 0 0 0-12 0c0 7-2.5 7-2.5 9h17C20.5 15 18 15 18 8ZM10 20h4" /><path d="m9.5 8.5 1.7 1.7 3.4-3.5" /></>,
    weather: <><path d="M6.5 16.5h10a3.5 3.5 0 1 0-1.3-6.75A4.75 4.75 0 0 0 6 11.25a2.65 2.65 0 0 0 .5 5.25Z" /><path d="M12 3v2M4.25 6.25l1.4 1.4M19.75 6.25l-1.4 1.4M4 20h16" /></>,
    scan: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12h8M12 8v8M7 7l2 2M17 7l-2 2M7 17l2-2M17 17l-2-2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.records}</svg>;
}
