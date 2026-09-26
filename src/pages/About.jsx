import { Nav, Panel } from "../components/Layout.jsx";
import { useText } from "../i18n.jsx";

const texts = {
  de: {
    title: "Über Anaviche AG",
    intro: "Wir entwickeln moderne Mehrfamilienhäuser, die Menschen ein Zuhause geben und Investoren langfristige Stabilität bieten.",
    cta: "Kontakt aufnehmen",
    whoTitle: "Wer wir sind",
    who: [
      "Anaviche AG ist auf den Erwerb und die Bewirtschaftung von Mehrfamilienhäusern in der Schweiz spezialisiert. Unser Ziel ist es, komfortable, moderne und gut gepflegte Wohnräume für Menschen zu schaffen, die möblierte Zimmer und Apartments suchen.",
      "Wir setzen auf langfristige Wertentwicklung, nachhaltige Weiterentwicklung und ein nahtloses Mieterlebnis.",
    ],
    vision: "Wir gestalten lebendige, zukunftsfähige Wohnräume, in denen Menschen sich sicher, inspiriert und unterstützt fühlen – und schaffen zugleich dauerhaften Wert für unsere Investoren.",
    mission: "Wir erwerben, modernisieren und betreiben Mehrfamilienhäuser mit Sorgfalt, Innovation und einem klaren Fokus auf die Bedürfnisse unserer Mieterinnen und Mieter.",
    foundersTitle: "Initiatoren",
    founders: (
      <>
        <strong>Neeraj Kumar</strong> und <strong>Simpal Kumar</strong> sind die Initiatoren der Anaviche AG. Beide verfügen über umfangreiche Erfahrung in Immobilieninvestitionen in Indien und Europa und verbinden fundierte Marktkenntnisse mit einer praxisnahen Investorenperspektive.
      </>
    ),
    foundersTech: "Als IT-Profis nutzen sie datenbasierte Analysen und moderne Technologien, um Chancen zu identifizieren, die Performance der Objekte zu optimieren und ein verlässliches Mieterlebnis zu sichern.",
    contactTitle: "Kontakt",
    contactIntro: "Für Vermietungsanfragen, Partnerschaften oder Investmentgespräche freuen wir uns auf Ihre Nachricht:",
    email: "E-Mail:",
    address: "Adresse:",
    addressValue: "ANAVICHE AG, Baar (ZG), Schweiz",
  },
  en: {
    title: "About Anaviche AG",
    intro: "We develop modern multifamily homes that give people a welcoming place to live while delivering long-term stability for investors.",
    cta: "Get in touch",
    whoTitle: "Who We Are",
    who: [
      "Anaviche AG specializes in acquiring and managing multifamily homes across Switzerland. Our mission is to create comfortable, modern, and well-maintained living spaces for individuals seeking fully furnished rooms and apartments.",
      "We focus on long-term property value, sustainable development, and providing a seamless rental experience for our tenants.",
    ],
    vision: "To shape vibrant, future-ready homes where people feel secure, inspired, and supported—while delivering enduring value for our investors.",
    mission: "To acquire, modernize, and operate multifamily properties with care, innovation, and a tenant-first mindset, creating high-quality living experiences and resilient returns.",
    foundersTitle: "Promoters",
    founders: (
      <>
        <strong>Neeraj Kumar</strong> and <strong>Simpal Kumar</strong> are the promoters of Anaviche AG. Both bring extensive experience in real estate investment across India and Europe, combining strong market knowledge with a practical, investor-focused mindset.
      </>
    ),
    foundersTech: "They are IT professionals who apply data-driven analysis and modern technology practices to identify opportunities, optimize property performance, and deliver a reliable tenant experience.",
    contactTitle: "Contact Us",
    contactIntro: "For leasing inquiries, partnerships, or investment discussions, please reach out to us:",
    email: "Email:",
    address: "Address:",
    addressValue: "ANAVICHE AG, Baar (ZG), Switzerland",
  },
};

export default function About() {
  const t = useText(texts);

  return (
    <div className="about-page">
      <Nav />
      <section className="hero-about">
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <a className="hero-cta" href="#contact">{t.cta}</a>
      </section>

      <main>
        <Panel id="about">
          <h2>{t.whoTitle}</h2>
          {t.who.map((p) => <p key={p}>{p}</p>)}
          <p><strong>Vision:</strong> {t.vision}</p>
          <p><strong>Mission:</strong> {t.mission}</p>
        </Panel>

        <Panel id="founders">
          <h2>{t.foundersTitle}</h2>
          <p>{t.founders}</p>
          <p>{t.foundersTech}</p>
        </Panel>

        <Panel id="contact">
          <h2>{t.contactTitle}</h2>
          <p>{t.contactIntro}</p>
          <p><strong>{t.email}</strong> anavicheag@outlook.com</p>
          <p><strong>{t.address}</strong> {t.addressValue}</p>
        </Panel>
      </main>
    </div>
  );
}
