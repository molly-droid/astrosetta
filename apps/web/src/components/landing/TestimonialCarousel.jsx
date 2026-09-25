import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

const TESTIMONIALS = [
  "Hands down the best astrology app I've ever used. I've honestly learned so much from Astrosetta, I find myself using it every day.",
  "To actually deep dive into my chart and explain it in a way that feels accessible, understandable, and genuinely educational... Astrosetta actually helps you learn instead of just giving the information without context.",
  "I've gotten to dig into my birth chart in a way I've never been able to, even with actual astrologers.",
  "Astrosetta is a great example of technology being used thoughtfully to educate, empower and make something as complex as astrology more approachable.",
  "You want to understand astrology? You need to use Astrosetta. I've already sent it to four friends.",
  "I love the journal, and I love that I get quizzed on what I'm actually learning... this is the first time astrology has actually stuck for me.",
];

const ROTATE_INTERVAL = 6000;

export default function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const measureRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(null);

  const next = useCallback(() => {
    setIndex(i => (i + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setIndex(i => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [next, paused]);

  // Measure actual text height synchronously before paint to avoid layout flash
  useLayoutEffect(() => {
    if (measureRef.current) {
      setContentHeight(measureRef.current.offsetHeight);
    }
  }, [index]);

  return (
    <section className="px-6 py-16 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>
          From our early testers
        </p>
        <h2 className="font-display text-3xl font-bold text-white">Loved by early learners</h2>
      </div>

      <div
        className="relative rounded-2xl p-8 md:p-10"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(201,169,97,0.15)',
          backdropFilter: 'blur(8px)',
          minHeight: contentHeight ? contentHeight + 130 : undefined,
          transition: 'min-height 0.3s ease',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Stars */}
        <div className="flex items-center justify-center gap-1 mb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={14} fill="#C9A961" style={{ color: '#C9A961' }} />
          ))}
        </div>

        {/* Quote */}
        <blockquote
          key={index}
          ref={measureRef}
          className="font-display text-lg md:text-xl italic text-center leading-relaxed animate-fade-up"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          "{TESTIMONIALS[index]}"
        </blockquote>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-6">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="transition-all rounded-full"
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                background: i === index ? '#C9A961' : 'rgba(255,255,255,0.2)',
              }}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>

        {/* Arrows */}
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hover:bg-white/10"
          aria-label="Previous testimonial"
        >
          <ChevronLeft size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors hover:bg-white/10"
          aria-label="Next testimonial"
        >
          <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
      </div>
    </section>
  );
}