import React from 'react';

// Decorative Concentrix brand shapes scattered behind a hero/section.
// Faint + floating for depth; purely decorative (aria-hidden, no pointer events).
export default function BrandShapes({ variant = 'hero' }) {
  const sets = {
    hero: [
      { src: '/brand/heart-o.svg', style: { top: '-40px', left: '-30px', width: 220 }, cls: 'float' },
      { src: '/brand/bullseye-o.svg', style: { top: '30px', right: '-40px', width: 180 }, cls: 'float-2' },
      { src: '/brand/arrow-o.svg', style: { bottom: '-50px', right: '18%', width: 150 }, cls: 'float-3' },
      { src: '/brand/power-o.svg', style: { bottom: '10px', left: '12%', width: 120 }, cls: 'float-2' },
    ],
    band: [
      { src: '/brand/bullseye-o.svg', style: { top: '-30px', right: '6%', width: 130 }, cls: 'float' },
      { src: '/brand/heart-o.svg', style: { bottom: '-40px', left: '4%', width: 120 }, cls: 'float-3' },
    ],
    catalog: [
      { src: '/brand/arrow-o.svg', style: { top: '5%', left: '-2%', width: 140 }, cls: 'float-2' },
      { src: '/brand/power-o.svg', style: { top: '15%', right: '-4%', width: 200 }, cls: 'float-3' },
      { src: '/brand/heart-o.svg', style: { top: '25%', left: '8%', width: 120 }, cls: 'float' },
      { src: '/brand/bullseye-o.svg', style: { top: '35%', right: '12%', width: 160 }, cls: 'float-2' },
      { src: '/brand/power-o.svg', style: { top: '48%', left: '-3%', width: 220 }, cls: 'float-3' },
      { src: '/brand/arrow-o.svg', style: { top: '60%', right: '-5%', width: 180 }, cls: 'float' },
      { src: '/brand/heart-o.svg', style: { top: '75%', left: '4%', width: 160 }, cls: 'float-2' },
      { src: '/brand/bullseye-o.svg', style: { bottom: '5%', right: '2%', width: 150 }, cls: 'float-3' },
      { src: '/brand/arrow-o.svg', style: { bottom: '15%', left: '15%', width: 130 }, cls: 'float' },
      { src: '/brand/heart-o.svg', style: { bottom: '25%', right: '8%', width: 140 }, cls: 'float-2' },
    ],
  };
  return (
    <div className="brand-bg" aria-hidden="true">
      {(sets[variant] || sets.hero).map((s, i) => (
        <img key={i} src={s.src} alt="" className={`brand-shape ${s.cls}`} style={s.style} draggable="false" />
      ))}
    </div>
  );
}
