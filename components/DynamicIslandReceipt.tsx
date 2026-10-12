'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Download, 
  RotateCcw, 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  Scissors, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface DynamicIslandReceiptProps {
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  items?: ReceiptItem[];
  totalAmount?: number;
  dateStr?: string;
  downloadUrl?: string | null;
  onTear?: () => void;
}

type PrinterState = 'standby' | 'printing' | 'printed' | 'torn';

export function DynamicIslandReceipt({
  orderNumber = 'ORD-0B53F0BF',
  customerName = 'Valued Customer',
  customerEmail = 'your email',
  items = [
    { name: 'Minimalist Notion Dashboard', price: 499 },
    { name: 'STUDENT Workspace OS', price: 599 },
  ],
  totalAmount = 1098,
  dateStr,
  downloadUrl = null,
  onTear,
}: DynamicIslandReceiptProps) {
  const [state, setState] = useState<PrinterState>('standby');
  const [printStep, setPrintStep] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; r: number; color: string; size: number; delay: number }>>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const formattedDate = dateStr || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Sound synthesis via Web Audio API (no external audio files needed)
  const playSound = (type: 'motor' | 'tear' | 'ding') => {
    if (!soundEnabled) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (type === 'motor') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'tear') {
        const bufferSize = ctx.sampleRate * 0.18;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'ding') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio autoplay gracefully handled
    }
  };

  // Run the line-by-line printing sequence on mount
  useEffect(() => {
    // 1. Initial warm up (0.4s)
    const t1 = setTimeout(() => {
      setState('printing');
      setPrintStep(1);
      playSound('motor');
    }, 500);

    // 2. Feed Step 2 (1.1s)
    const t2 = setTimeout(() => {
      setPrintStep(2);
      playSound('motor');
    }, 1100);

    // 3. Feed Step 3 (1.7s)
    const t3 = setTimeout(() => {
      setPrintStep(3);
      playSound('motor');
    }, 1700);

    // 4. Feed Step 4 (2.3s)
    const t4 = setTimeout(() => {
      setPrintStep(4);
      playSound('motor');
    }, 2300);

    // 5. Complete Print (3.0s)
    const t5 = setTimeout(() => {
      setPrintStep(5);
      setState('printed');
      playSound('ding');
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Tear Action
  const handleTear = () => {
    if (state !== 'printed') return;
    playSound('tear');
    setState('torn');

    // Generate colorful celebration confetti
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#eab308'];
    const newConfetti = Array.from({ length: 48 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      r: Math.random() * 360,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 8,
      delay: Math.random() * 0.4,
    }));
    setConfetti(newConfetti);

    if (onTear) onTear();
  };

  // Replay print animation
  const handleReplay = () => {
    setConfetti([]);
    setState('standby');
    setPrintStep(0);
    setTimeout(() => {
      setState('printing');
      setPrintStep(1);
      playSound('motor');
      setTimeout(() => { setPrintStep(2); playSound('motor'); }, 600);
      setTimeout(() => { setPrintStep(3); playSound('motor'); }, 1200);
      setTimeout(() => { setPrintStep(4); playSound('motor'); }, 1800);
      setTimeout(() => {
        setPrintStep(5);
        setState('printed');
        playSound('ding');
      }, 2400);
    }, 400);
  };

  return (
    <div className="relative w-full max-w-[390px] mx-auto select-none my-4">
      {/* Background Confetti particles when torn */}
      {state === 'torn' && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
          {confetti.map((c) => (
            <div
              key={c.id}
              className="absolute animate-confetti-fall"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: `${c.size}px`,
                height: `${c.size * 0.6}px`,
                backgroundColor: c.color,
                borderRadius: '2px',
                transform: `rotate(${c.r}deg)`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${2.4 + (c.id % 5) * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Top Audio Toggle */}
      <div className="flex items-center justify-between px-2 mb-3 text-xs text-gray-500 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          <span className="font-semibold text-gray-800">Thermal Printer</span>
          <span>•</span>
          <span className="uppercase text-[11px]">{state === 'printed' ? 'Ready' : state === 'torn' ? 'Detached' : 'Printing'}</span>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:text-black hover:border-gray-400 transition-colors cursor-pointer text-[11px] shadow-2xs"
          title={soundEnabled ? 'Mute mechanical sound' : 'Enable mechanical sound'}
        >
          {soundEnabled ? <Volume2 className="w-3 h-3 text-emerald-600" /> : <VolumeX className="w-3 h-3 text-gray-400" />}
          <span>{soundEnabled ? 'Audio On' : 'Audio Muted'}</span>
        </button>
      </div>

      {/* STANDALONE THERMAL PRINTER MACHINE (.machine) */}
      <div className="relative z-30 w-full flex flex-col items-center">
        
        {/* Sleek Metallic / Charcoal Printer Head Unit */}
        <div className="w-full h-[52px] rounded-2xl bg-neutral-900 border border-neutral-700/80 shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.15)] flex items-center justify-between px-4 sm:px-5">
          
          {/* Status LED & Status Label */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                state === 'printed' || state === 'torn'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-neutral-300">
              {state === 'printed' ? 'READY' : state === 'torn' ? 'DETACHED' : 'FEEDING'}
            </span>
          </div>

          {/* Machine Brand Badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-neutral-400 font-bold uppercase">
            <div className="w-2.5 h-2.5 bg-neutral-700 rounded-xs flex items-center justify-center text-[7px] text-white">
              M
            </div>
            <span>STUDIO MAYA</span>
          </div>
        </div>

        {/* Paper Slot Aperture (The narrow slit where paper emerges) */}
        <div className="w-[90%] h-[6px] bg-neutral-950 rounded-full border border-neutral-800 shadow-[inset_0_3px_5px_rgba(0,0,0,0.95)] -mt-1.5 z-40 relative">
          <div className="absolute inset-x-6 top-0 h-[1.5px] bg-neutral-700/70 rounded-full" />
        </div>
      </div>

      {/* THERMAL RECEIPT SHEET (.receipt) */}
      <div className="relative w-full flex flex-col items-center z-20 mt-[-2px]">
        
        <div
          onClick={handleTear}
          className={`relative w-[92%] bg-white text-neutral-900 rounded-b-[24px] border border-gray-200/90 shadow-[0_24px_44px_-16px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.06)] transition-all ease-out cursor-pointer overflow-hidden ${
            state === 'torn'
              ? 'translate-y-6 rotate-2 shadow-2xl opacity-98 duration-300'
              : state === 'printed'
              ? 'hover:-translate-y-0.5 hover:shadow-[0_28px_50px_-16px_rgba(0,0,0,0.25)] duration-200 animate-receipt-settle'
              : 'duration-500'
          }`}
          style={{
            maxHeight:
              printStep === 0
                ? '0px'
                : printStep === 1
                ? '125px'
                : printStep === 2
                ? '215px'
                : printStep === 3
                ? '320px'
                : printStep === 4
                ? '415px'
                : '550px',
          }}
        >
          {/* Perforated Top Edge (Tear Guide) */}
          <div className="w-full h-3 flex items-center justify-between px-1 border-b border-dashed border-gray-300 bg-gray-50">
            {Array.from({ length: 22 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400/30 -mt-1" />
            ))}
          </div>

          {/* Prompt Banner */}
          {state === 'printed' && (
            <div className="bg-amber-50 text-amber-900 text-[10px] font-bold tracking-wider uppercase py-1 px-3 text-center flex items-center justify-center gap-1.5 border-b border-amber-200 animate-pulse">
              <Scissors className="w-3 h-3 text-amber-800" />
              <span>Tap receipt to tear off</span>
            </div>
          )}

          {state === 'torn' && (
            <div className="bg-emerald-50 text-emerald-800 text-[10px] font-bold tracking-wider uppercase py-1 px-3 text-center flex items-center justify-center gap-1.5 border-b border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Receipt Detached & Saved</span>
            </div>
          )}

          {/* Thermal Receipt Content */}
          <div className="p-4 sm:p-5 font-mono text-[11px] leading-relaxed text-neutral-800">
            
            {/* Step 1: Header & Brand */}
            <div className="text-center pb-3">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-4 h-4 bg-black rounded-xs flex items-center justify-center text-white text-[8px] font-black">
                  M
                </div>
                <span className="font-extrabold text-[13px] tracking-widest text-neutral-950 font-sans">
                  STUDIO MAYA
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                Verified Digital Receipt
              </p>
              <div className="mt-2 text-[10px] text-neutral-600 space-y-0.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-neutral-500">ORDER:</span>
                  <span className="text-black font-bold font-mono">{orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">DATE:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">BUYER:</span>
                  <span className="truncate max-w-[170px]">{customerName}</span>
                </div>
              </div>
            </div>

            {/* Step 2: Perforation separator & Items Table */}
            {printStep >= 2 && (
              <div className="pt-2 border-t border-dashed border-neutral-300">
                <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-1">
                  <span>Item Description</span>
                  <span>Amount</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-baseline gap-2 text-[11px]">
                      <span className="font-medium text-neutral-900 truncate">
                        {item.name}
                      </span>
                      <span className="shrink-0 font-bold text-black font-mono">
                        ₹{item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Financial Totals */}
            {printStep >= 3 && (
              <div className="mt-3 pt-2 border-t border-dashed border-neutral-300 space-y-1 text-[11px]">
                <div className="flex justify-between text-neutral-600">
                  <span>SUBTOTAL</span>
                  <span className="font-mono">₹{totalAmount}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>LAUNCH DISCOUNT</span>
                  <span className="font-mono">-₹0.00</span>
                </div>
                <div className="flex justify-between text-[13px] font-extrabold text-neutral-950 pt-1 border-t border-neutral-200">
                  <span>TOTAL PAID</span>
                  <span className="font-mono font-black">₹{totalAmount}</span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-700 font-bold pt-0.5">
                  <span>PAYMENT STATUS</span>
                  <span className="flex items-center gap-1 font-mono">
                    PAID ✓
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>DELIVERY ACCESS</span>
                  <span>INSTANT & LIFETIME</span>
                </div>
              </div>
            )}

            {/* Step 4: Barcode & Brand Footer */}
            {printStep >= 4 && (
              <div className="mt-4 pt-3 border-t border-dashed border-neutral-300 text-center">
                {/* Realistic Thermal SVG Barcode */}
                <div className="flex justify-center items-center gap-[2.5px] h-9 my-1 opacity-90 px-2">
                  {Array.from({ length: 38 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-black h-full"
                      style={{
                        width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1.5 : 2.5)}px`,
                        opacity: i % 7 === 0 ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
                <p className="text-[9px] tracking-widest text-neutral-500 font-mono mt-1">
                  * {orderNumber} *
                </p>
                <p className="text-[10px] font-bold text-neutral-800 tracking-wider mt-1.5 font-sans">
                  WELCOME TO THE STUDIO
                </p>
                <p className="text-[9px] text-neutral-400 mt-0.5">
                  Keep this slip for your records
                </p>
              </div>
            )}

            {/* Bottom Jagged Paper Receipt Edge */}
            <div className="mt-4 -mx-5 -mb-5 h-2 bg-[radial-gradient(circle,_transparent_3px,_#ffffff_3px)] bg-[length:8px_8px] -rotate-180 opacity-60" />
          </div>
        </div>
      </div>

      {/* POST-TEAR REVEALED ACTIONS */}
      <div
        className={`w-full mt-6 px-1 transition-all duration-500 ${
          state === 'torn'
            ? 'opacity-100 translate-y-0'
            : state === 'printed'
            ? 'opacity-90 translate-y-1'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {state === 'printed' && (
          <div className="text-center">
            <button
              onClick={handleTear}
              className="w-full bg-black text-white hover:bg-neutral-800 transition-all font-semibold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Scissors className="w-4 h-4 text-white" />
              <span>Tear Receipt Off</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </button>
          </div>
        )}

        {state === 'torn' && (
          <div className="space-y-3 pt-2">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-xs font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Purchase Verified Successfully</span>
              </div>
              <p className="text-xs text-gray-500">
                Receipt and workspace access dispatched to <span className="text-gray-900 font-medium">{customerEmail}</span>
              </p>
            </div>

            {/* Instant Download / Workspace Action */}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Purchased Files</span>
              </a>
            ) : (
              <Link
                href="/account/orders"
                className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Access in My Purchases</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            {/* Replay and Store Links */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleReplay}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Print</span>
              </button>

              <Link
                href="/"
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>Back to Store</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
