"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletChip } from "@/components/WalletChip";

// Merges landing_page/code.html (desktop) and landing_page_mobile/code.html
// (mobile) into one responsive route, per Task 5. The two exports use
// meaningfully different hero treatments (desktop: hardware-module photo
// card; mobile: abstract circuit/hub graphic) rather than one graphic that
// simply reflows, so both are kept in the DOM and toggled with
// `md:hidden` / `hidden md:block` rather than forced into one shared markup
// tree — that's the most faithful way to match both screen.png references.
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="font-body-md text-body-md overflow-x-hidden selection:bg-primary-container selection:text-white min-h-screen">
      {/* Desktop header */}
      <header className="hidden md:flex bg-surface w-full top-0 sticky z-50 border-b border-outline justify-between items-center px-margin-desktop py-technical-gap">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2 font-headline-md text-headline-md font-black tracking-tighter text-primary uppercase">
            <img src="/logo.png" alt="" className="w-8 h-8" />
            PROVIDER COURT
          </span>
          <nav className="hidden md:flex gap-6">
            <Link className="text-on-surface-variant font-mono-label text-mono-label hover:text-primary transition-colors" href="/listings/browse">
              Browse Listings
            </Link>
            <Link className="text-on-surface-variant font-mono-label text-mono-label hover:text-primary transition-colors" href="/providers/register">
              Providers
            </Link>
            <Link className="text-on-surface-variant font-mono-label text-mono-label hover:text-primary transition-colors" href="/activity">
              Activity
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/listings/browse"
            className="bg-primary px-6 py-2 text-white font-mono-label text-mono-label active:scale-95 duration-75 uppercase tracking-widest border border-black shadow-[2px_2px_0px_black]"
          >
            Enter App
          </Link>
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary">
              notifications
            </span>
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary">
              settings
            </span>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface border-b border-outline">
        <div className="flex items-center gap-2 font-headline-md text-[24px] tracking-tighter text-primary uppercase font-bold">
          <img src="/logo.png" alt="" className="w-7 h-7" />
          PROVIDER COURT
        </div>
        <button
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="material-symbols-outlined text-primary p-2"
          aria-label="Menu"
        >
          menu
        </button>
      </header>
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 w-full z-50 bg-surface border-b border-outline flex flex-col p-margin-mobile gap-1">
          <Link className="py-3 font-mono-label text-mono-label text-on-surface-variant" href="/listings/browse">
            Browse Jobs
          </Link>
          <Link className="py-3 font-mono-label text-mono-label text-on-surface-variant" href="/providers/register">
            Providers
          </Link>
          <Link className="py-3 font-mono-label text-mono-label text-on-surface-variant" href="/activity">
            Activity
          </Link>
        </div>
      )}

      <main className="relative md:pt-0 pt-16">
        <div className="hidden md:block fixed inset-0 bg-technical-grid opacity-20 pointer-events-none z-0" />

        {/* Desktop hero */}
        <section className="hidden md:flex relative min-h-[921px] flex-col justify-center px-margin-desktop py-20 z-10">
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 md:col-span-8 flex flex-col justify-center">
              <div className="mb-6 flex items-center gap-3">
                <span className="font-mono-data text-mono-data bg-primary text-white px-2 py-1">
                  [00] STATUS: LIVE ON GENLAYER STUDIO (TESTNET)
                </span>
                <div className="led-dot" />
              </div>
              <h1 className="font-display-lg text-display-lg leading-tight mb-8">
                The <span className="text-primary">Intelligent</span> Contract marketplace for <br />
                <span className="italic" style={{ WebkitTextStroke: "1px #281712", color: "transparent" }}>
                  AI-generated work.
                </span>
              </h1>
              <p className="font-body-lg text-body-lg max-w-xl mb-10 text-on-surface-variant">
                Escrow for AI-generated work, adjudicated automatically by GenVM consensus -- no human
                reviewer in the loop. Every delivery is judged against the buyer's own clauses on the
                Provider Court Protocol -- running today on GenLayer Studio, the current public testnet.
                Every transaction uses test GEN with no real monetary value; GenLayer mainnet does not
                exist yet.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/listings/browse"
                  className="bg-primary text-white font-headline-md text-[24px] px-12 py-6 border-2 border-black hover:bg-primary-container transition-all flex items-center gap-4 shadow-[8px_8px_0px_black]"
                >
                  ENTER APP <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
                <button className="bg-white text-black font-headline-md text-[24px] px-12 py-6 border-2 border-black hover:bg-surface-variant transition-all shadow-[8px_8px_0px_black]">
                  READ DOCS
                </button>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 relative hidden md:block">
              <div className="hardware-module bg-white p-6 absolute top-0 right-0 w-full aspect-square flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="font-mono-data text-mono-data uppercase">
                    Unit ID: PC-001
                    <br />
                    Network: GenLayer Studio (Testnet)
                  </div>
                  <div className="w-12 h-12 border border-black rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      terminal
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-[1px] bg-black w-full" />
                  <div className="flex justify-between font-mono-data text-mono-data">
                    <span>TX_AUDIT_LOG</span>
                    <span>ON-CHAIN</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <div className="w-8 h-8 bg-primary" />
                  <div className="w-8 h-8 bg-surface-variant" />
                  <div className="w-8 h-8 bg-secondary" />
                  <div className="w-8 h-8 bg-tertiary" />
                  <div className="w-8 h-8 bg-black" />
                </div>
                <img
                  className="w-full h-40 object-cover border border-black grayscale contrast-125"
                  alt="Macro photograph of a high-tech circuit board with glowing orange LEDs."
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCI8MYI3Fcblfc8GWz2ID5SHp76f_sRJJJn1B0FCOCCkjg0lCi0JP1hS9G0kvC8k7QUTkdIxkrgUdJD2dbF42pzqTN0sG0wPdBDVFqSeoU3asNj-NrQYUI30sYKvt0BDye26m97_RGwLxqGSr5QJD-RiuA12fozzGSBWuKdlmTNlhc2zYTh-7sgoQ3WLhmq0sDbTQb2rydsBdV6gUr1AavCGrVmwH_rOlg3bVH3vohex3HeydxJqxQJ88HbUkq0oZ8sNBrWV_bBRGTw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile hero */}
        <section className="md:hidden relative bg-technical-grid flex flex-col">
          <div className="scanline" />
          <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden p-margin-mobile">
            <div className="relative w-full h-full border border-outline opacity-50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-primary rotate-45 flex items-center justify-center">
                  <div className="w-32 h-32 border border-secondary p-2 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary scale-[3]"
                      style={{ fontVariationSettings: "'wght' 200" }}
                    >
                      hub
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary opacity-30" />
              </div>
              <div className="absolute bottom-4 right-4 bg-surface-container-high border border-outline px-2 py-1">
                <span className="font-mono-data text-mono-data text-primary">[SYSTEM_BOOT: READY]</span>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 hardware-border bg-surface p-4 flex flex-col gap-technical-gap">
              <div className="flex justify-between items-center border-b border-outline pb-2">
                <span className="font-mono-label text-mono-data text-on-surface-variant">[PROTOCOL_V1]</span>
                <span className="font-mono-label text-mono-data text-secondary">ACTIVE</span>
              </div>
              <div className="font-mono-data text-[10px] leading-tight text-on-surface-variant opacity-60">
                NETWORK: GenLayer Studio (Testnet)
                <br />
                CONSENSUS: GenVM Multi-Validator
                <br />
                ESCROW: On-Chain, Programmatic
              </div>
            </div>
          </div>
          <div className="flex-grow px-margin-mobile pb-24 flex flex-col">
            <div className="mb-4">
              <span className="font-mono-label text-mono-label text-primary bg-primary-fixed px-2 py-1">
                [01] MARKETPLACE_INIT
              </span>
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight mb-6">
              Intelligent <br />
              <span className="text-primary italic">Contract</span> <br />
              Marketplace.
            </h1>
            <p className="text-on-surface-variant mb-8 max-w-xs">
              A brutalist approach to decentralized escrow. Automated, on-chain adjudication and technical
              transparency for the modern provider.
            </p>
            <div className="flex flex-col gap-4">
              <Link
                href="/listings/browse"
                className="w-full h-14 bg-primary text-on-primary font-mono-label text-lg tracking-widest flex items-center justify-center hardware-border active:translate-x-1 active:translate-y-1 transition-transform"
              >
                ENTER APP
              </Link>
              <button className="w-full h-14 border border-outline text-on-surface font-mono-label text-lg tracking-widest flex items-center justify-center hover:bg-surface-container-high transition-colors">
                [READ_DOCS]
              </button>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-4">
              <div className="border-l-2 border-primary pl-3">
                <div className="font-mono-label text-mono-data text-on-surface-variant opacity-70">ESCROW_MODEL</div>
                <div className="font-headline-md text-xl">Gasless</div>
              </div>
              <div className="border-l-2 border-secondary pl-3">
                <div className="font-mono-label text-mono-data text-on-surface-variant opacity-70">SETTLEMENT</div>
                <div className="font-headline-md text-xl">Auto-Adjudicated</div>
              </div>
            </div>
          </div>
        </section>

        {/* [01] Specifications Grid — desktop only per source */}
        <section className="hidden md:block bg-secondary-container py-20 border-y-2 border-black relative z-10">
          <div className="px-margin-desktop">
            <div className="flex items-center gap-4 mb-12">
              <span className="font-headline-lg text-headline-lg text-on-secondary-container">[01]</span>
              <h2 className="font-headline-lg text-headline-lg uppercase text-on-secondary-container">
                Technical Specs
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {[
                {
                  id: "SPEC_001",
                  title: "Automated Verdict Consensus",
                  body: "Every delivery is judged by GenVM's Optimistic Democracy: a randomly selected leader evaluates the artifact against the buyer's clauses, and independent validators must reach the same verdict before it finalizes. No human reviewer, no manual sign-off, ever.",
                  hover: "hover:bg-primary",
                },
                {
                  id: "SPEC_002",
                  title: "Bonded Appeal Protocol",
                  body: "Disagree with a verdict? Stake a bond to trigger a second, independent GenVM re-adjudication. If the outcome changes, your bond comes back; if it doesn't, the other party receives it -- resolved entirely on-chain, no arbitrator involved.",
                  hover: "hover:bg-secondary",
                },
                {
                  id: "SPEC_003",
                  title: "Testnet Sandbox",
                  body: "Running today on GenLayer Studio, the current public testnet -- gasless test transactions with zero real financial risk, ahead of GenLayer mainnet's own launch (not yet live).",
                  hover: "hover:bg-tertiary",
                },
              ].map((spec) => (
                <div
                  key={spec.id}
                  className={`hardware-module bg-white p-8 group transition-colors duration-300 ${spec.hover}`}
                >
                  <span className="font-mono-data text-mono-data block mb-4 group-hover:text-white">
                    {spec.id}
                  </span>
                  <h3 className="font-headline-md text-headline-md mb-4 group-hover:text-white">{spec.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant group-hover:text-white">
                    {spec.body}
                  </p>
                  <div className="mt-8 h-[2px] bg-black group-hover:bg-white w-1/4" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured asymmetric section — desktop only per source */}
        <section className="hidden md:block py-32 px-margin-desktop relative z-10">
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 md:col-span-5 flex flex-col justify-center">
              <span className="font-mono-label text-mono-label text-primary mb-2 uppercase">[02] CORE INTERFACE</span>
              <h2 className="font-display-lg text-headline-lg mb-6 leading-none">
                Precision <br />
                Management.
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
                The Provider Court dashboard tracks every order from purchase through automatic delivery and
                adjudication, with a real reputation score for every provider computed directly from their
                own settlement history.
              </p>
              <ul className="space-y-4 mb-10">
                {["REAL-TIME REPUTATION SCORING", "PROGRAMMATIC WORKFLOWS", "CRYPTO-NATIVE ARBITRATION"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3 font-mono-label text-mono-label">
                      <span className="material-symbols-outlined text-primary">check_circle</span> {item}
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="col-span-12 md:col-span-7 flex justify-end">
              <div className="relative w-full max-w-2xl">
                <div className="hardware-module bg-surface-container-high p-4 overflow-hidden">
                  <div className="bg-black text-white p-2 font-mono-data text-[10px] mb-4 flex justify-between">
                    <span>INTERFACE_V1.04</span>
                    <span>SYSTEM_READY</span>
                  </div>
                  <div
                    className="w-full h-[500px] bg-cover bg-center border border-black"
                    style={{
                      backgroundImage:
                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuApYg73s4gUkKch4yDEd6Fd9BF0H6XTXjw5Sw_Q48P3GH7feQnp7-RPegmUJZPKWvmcpfHIbbwsaCMtBtn4Am_0DxwqNh_Ib_V3mmyM5-G6XBIhMY5pVJHzyOefdqn3OEwjr_DvH7E2-luE9wtrfhr6vsu2ztBMDX-LL3689eEUqt_C__4RQRnP6uedtCquwFXRqjY9P7av8tOo5TpMzIfPRT1Ggff7onWA0QmDCFfbF6f0B-oy6zH2C_tc90uA5t87U4t_FMPDyGpG')",
                    }}
                  />
                </div>
                <div className="absolute -bottom-10 -left-10 bg-primary text-white p-6 border-2 border-black shadow-[8px_8px_0px_black] max-w-[200px]">
                  <span className="font-mono-data block mb-2">GASLESS TXS</span>
                  <div className="text-[32px] font-bold">100%</div>
                  <div className="h-1 w-full bg-white/20 mt-2">
                    <div className="h-full bg-white w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA / bento section — desktop only per source */}
        <section className="hidden md:block bg-primary pt-24 pb-48 relative overflow-hidden z-10 border-t-2 border-black">
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
            <span className="font-black text-[30vw] leading-none text-white uppercase">RELIANCE</span>
          </div>
          <div className="px-margin-desktop relative z-10 text-white flex flex-col items-center text-center">
            <span className="font-mono-label text-mono-label mb-4 tracking-[0.3em]">[03] THE FUTURE OF WORK</span>
            <h2 className="font-headline-lg text-headline-lg mb-8 uppercase max-w-4xl mx-auto leading-tight">
              Scale your operations with autonomous service providers.
            </h2>
            <div className="flex gap-4">
              <Link
                href="/providers/register"
                className="bg-black text-white px-12 py-6 font-mono-label text-[20px] uppercase border border-white hover:bg-white hover:text-black transition-all shadow-[8px_8px_0px_rgba(255,255,255,0.2)]"
              >
                Explore Providers
              </Link>
              <Link
                href="/providers/register"
                className="bg-white text-primary px-12 py-6 font-mono-label text-[20px] uppercase border border-black hover:bg-primary-container hover:text-white transition-all shadow-[8px_8px_0px_black]"
              >
                Become a Partner
              </Link>
            </div>
          </div>
          <div className="px-margin-desktop mt-20 grid grid-cols-12 gap-gutter">
            <div className="col-span-12 md:col-span-4 hardware-module bg-white p-6 h-64 flex flex-col justify-between">
              <span className="material-symbols-outlined text-primary text-4xl">percent</span>
              <div>
                <h4 className="font-mono-label text-black text-lg font-bold">WEIGHTED PARTIAL RELEASE</h4>
                <p className="text-on-surface-variant text-sm mt-2 font-mono-data">
                  Escrow isn't all-or-nothing -- funds release in proportion to how many delivery clauses
                  actually pass, weighted by importance.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 hardware-module bg-surface-variant p-6 h-64 flex flex-col justify-between">
              <span className="material-symbols-outlined text-black text-4xl">bolt</span>
              <div>
                <h4 className="font-mono-label text-black text-lg font-bold">ZERO-TOUCH FULFILLMENT</h4>
                <p className="text-on-surface-variant text-sm mt-2 font-mono-data">
                  A purchase automatically triggers generation, delivery, and adjudication in one flow --
                  no second wallet prompt, no manual provider action.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 hardware-module bg-black p-6 h-64 flex flex-col justify-between border-white">
              <span className="material-symbols-outlined text-primary text-4xl">fingerprint</span>
              <div>
                <h4 className="font-mono-label text-white text-lg font-bold">CONTENT-ADDRESSED DELIVERY</h4>
                <p className="text-gray-400 text-sm mt-2 font-mono-data">
                  Every delivered artifact is pinned to IPFS and referenced on-chain by its content hash --
                  independently fetchable and verifiable by anyone.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact section — desktop only per source */}
        <section className="hidden md:block bg-surface-container-lowest py-20 px-margin-desktop relative z-10 border-t border-black -mt-24 mx-margin-desktop hardware-module">
          <div className="grid grid-cols-12 gap-gutter items-center">
            <div className="col-span-12 md:col-span-6">
              <h2 className="font-headline-md text-headline-md mb-4">
                Questions about the protocol, deployment, or network nodes?
              </h2>
              <button className="bg-primary text-white px-8 py-4 font-mono-label uppercase flex items-center gap-3">
                Email Support <span className="material-symbols-outlined">mail</span>
              </button>
            </div>
            <div className="col-span-12 md:col-span-6 flex justify-end">
              <img
                className="w-full max-w-md h-auto grayscale"
                alt="Stylized technical illustration of computer components and a futuristic helmet."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGfieRhQqqoclcYMFdG8ooJtP26LC23dBnvBpMI2L0dIJUe4b8Ct6EHBqXAfSlw63PSx6HjnyPV2CR-WA0rU7hifhjQoQj-REN5b6JNKx7wK_Wj6qFQ4hfG6YdbFF2u90T7Nbn1SMJsPo-WvWRVyTorPcacpSTrmJuZjt1P0Os0kaZ4wY36dsl2NK8LPQsEGIwZzbQwjdfaBYAY1Bvq267Qr8DF-qf2Z6WKzJdWNJYvXT0KY_kS8uHS0yxTT4Pasa4O7r-OFZTXRym"
              />
            </div>
          </div>
        </section>
      </main>

      {/* Desktop footer */}
      <footer className="hidden md:block bg-surface-container-lowest border-t border-outline mt-20 w-full">
        <div className="grid grid-cols-12 gap-gutter px-margin-desktop py-12 w-full items-center">
          <div className="col-span-12 md:col-span-6">
            <span className="font-headline-lg text-[64px] font-black text-on-surface opacity-10 tracking-tighter uppercase block mb-4">
              PROVIDER COURT
            </span>
            <p className="font-mono-data text-mono-data uppercase text-on-surface-variant">
              © 2024 PROVIDER COURT ESCROW PROTOCOL [REV 1.0.4]
            </p>
          </div>
          <div className="col-span-12 md:col-span-6 flex flex-col md:items-end gap-2">
            <div className="flex flex-wrap gap-6 font-mono-data text-mono-data uppercase mb-4">
              <a className="text-on-surface-variant hover:text-primary transition-all underline" href="#">
                Privacy Policy
              </a>
              <a className="text-on-surface-variant hover:text-primary transition-all underline" href="#">
                Terms of Service
              </a>
              <a className="text-on-surface-variant hover:text-primary transition-all underline" href="#">
                API Specs
              </a>
              <a className="text-on-surface-variant hover:text-primary transition-all underline" href="#">
                Uptime Status
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono-data text-mono-data uppercase text-on-surface-variant opacity-50">
                NETWORK: GENLAYER STUDIO (TESTNET) -- MAINNET NOT YET LAUNCHED
              </span>
              <div className="led-dot" />
            </div>
          </div>
        </div>
        <div className="bg-black text-white py-4 px-margin-desktop flex justify-between items-center font-mono-data text-[10px]">
          <span>[SYS_CLK]: 0XF382A...</span>
          <span>DESIGNED BY INDUSTRIAL SYNTH UNIT</span>
          <span>[04] AUTHENTICATED</span>
        </div>
      </footer>

      {/* Mobile bottom nav + footer */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-surface border-t border-outline flex items-center justify-around z-50">
        <Link className="flex flex-col items-center gap-1 text-primary" href="/">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            dashboard
          </span>
          <span className="font-mono-data text-[10px]">HOME</span>
        </Link>
        <Link className="flex flex-col items-center gap-1 text-on-surface-variant" href="/listings/browse">
          <span className="material-symbols-outlined">explore</span>
          <span className="font-mono-data text-[10px]">BROWSE</span>
        </Link>
        <div className="relative -top-4">
          <Link
            href="/listings/new"
            className="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center hardware-border"
          >
            <span className="material-symbols-outlined">add</span>
          </Link>
        </div>
        <div className="text-on-surface-variant">
          <WalletChip />
        </div>
        <Link className="flex flex-col items-center gap-1 text-on-surface-variant" href="/activity">
          <span className="material-symbols-outlined">settings</span>
          <span className="font-mono-data text-[10px]">CONFIG</span>
        </Link>
      </nav>
      <footer className="md:hidden w-full py-4 px-margin-mobile bg-surface-dim border-t border-outline mb-16 flex flex-col gap-2">
        <div className="flex justify-between items-center opacity-60">
          <span className="font-mono-data text-[10px]">©2024 PROVIDER COURT // PROTOCOL_V1.0.4</span>
          <span className="font-mono-data text-[10px] text-secondary">STATUS: OK</span>
        </div>
        <div className="flex gap-4 overflow-x-auto py-2">
          <span className="font-mono-data text-[10px] whitespace-nowrap bg-surface-container-high px-2">[LEGAL]</span>
          <span className="font-mono-data text-[10px] whitespace-nowrap bg-surface-container-high px-2">
            [API_DOCS]
          </span>
          <span className="font-mono-data text-[10px] whitespace-nowrap bg-surface-container-high px-2">
            [GASLESS_TESTNET]
          </span>
        </div>
      </footer>
    </div>
  );
}
