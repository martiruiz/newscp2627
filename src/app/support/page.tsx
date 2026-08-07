"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What is Sports Content Playbook and how can it help me grow?",
    a: "Sports Content Playbook is a platform that helps inspire clubs, sponsors, agencies and sports content creators. Filter by replicable idea, trending topic, sport, competition, platform, format and campaigns — see real examples and analyse why they work. The result: more consistency, more variety and fewer brainstorming hours.",
  },
  {
    q: "Who can use Sports Content Playbook?",
    a: "Clubs, federations, competitions, sponsors, agencies and independent content creators. Even if you have a complete team or are working solo, the Playbook provides actionable and replicable ideas.",
  },
  {
    q: "Will it help me if I have few followers?",
    a: "Yes. Growth comes from consistency + proven ideas. Sports Content Playbook gives you the structure to execute regularly and with quality, even if you're just starting out.",
  },
  {
    q: "Will Sports Content Playbook make my posts go viral?",
    a: "We don't promise virality. We promise a methodology and proven ideas that increase your chances of reach and engagement. The final result depends on execution — timing, editing, consistency, and adapting ideas to your context.",
  },
  {
    q: "Which sports and platforms does SCP cover?",
    a: "Multi-sport (football and other major disciplines, constantly expanding) and formats for Instagram, TikTok, YouTube, X/Twitter, Facebook and Shorts. Each idea includes a recommended format.",
  },
  {
    q: "How often is the content updated?",
    a: "Continuous updates — new ideas and examples are added throughout the week, plus a weekly summary with the best of the period in our newsletter and blog.",
  },
  {
    q: "Do I need design or editing skills?",
    a: "No. Ideas come with clear guides. If you have a team or tools (Canva, CapCut, Premiere…), great — but it's not required to get started.",
  },
  {
    q: "Does Sports Content Playbook publish or schedule content for me?",
    a: "No. Sports Content Playbook is ideation + methodology. You can save your ideas, organise them and use them to build your content plan.",
  },
  {
    q: "How can I get help or suggest a feature?",
    a: "You can reach us through the Contact form below. We're also on Instagram and LinkedIn — follow us there for support and updates.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 1200);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Hero */}
      <div
        className="text-center px-6 py-12 md:py-20"
        style={{
          background: "linear-gradient(180deg, rgba(31,41,55,0.06) 0%, transparent 100%)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6" style={{ background: "rgba(31,41,55,0.08)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-charcoal)" strokeWidth="1.8">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </span>
        <h1 className="font-black text-3xl md:text-5xl mb-4" style={{ color: "var(--text-primary)" }}>
          How can we help?
        </h1>
        <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Find answers to common questions or reach out to our team directly. We&apos;re here to help you get the most out of the platform.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          {[
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
              title: "FAQs",
              desc: "Browse common questions and answers",
              href: "#faq",
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
              title: "Email us",
              desc: "info@sportscontentplaybook.com",
              href: "mailto:info@sportscontentplaybook.com",
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
              title: "Contact form",
              desc: "Send us a message and we'll reply",
              href: "#contact",
            },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="flex flex-col gap-3 p-5 rounded-2xl transition-all hover:shadow-md"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "inherit", textDecoration: "none" }}
            >
              <span style={{ color: "var(--color-charcoal)" }}>{item.icon}</span>
              <div>
                <p className="font-bold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
              </div>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <section id="faq" className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="font-black text-2xl" style={{ color: "var(--text-primary)" }}>Frequently asked questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                  style={{ color: "var(--text-primary)" }}
                >
                  <span className="font-semibold text-sm leading-snug">{faq.q}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "var(--text-muted)" }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section id="contact">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="font-black text-2xl" style={{ color: "var(--text-primary)" }}>Send us a message</h2>
          </div>
          <div
            className="rounded-2xl p-6 md:p-8"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            {sent ? (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: "rgba(34,197,94,0.12)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>Message sent!</h3>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Thanks for reaching out. We&apos;ll get back to you within 24–48 hours.</p>
                <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }} className="mt-6 px-5 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80" style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Subject</label>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                    placeholder="What is your question about?"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    rows={5}
                    placeholder="Describe your issue or question in detail…"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>We reply within 24–48 hours on business days.</p>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#1F2937", color: "#fff" }}
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send message
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
