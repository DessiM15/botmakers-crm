import Image from "next/image";
import { LogOut, Zap } from "lucide-react";

export function AmfnHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-transparent"
      style={{
        borderImage: "linear-gradient(90deg, transparent, rgba(3,255,0,0.15), transparent) 1",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <Image
              src="/amfn/american-fusion-logo.png"
              alt="American Fusion"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">
            American Fusion Inc.
          </span>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[#03FF00] amfn-status-pulse" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-[#03FF00]" />
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Zap className="h-3.5 w-3.5 text-[#03FF00]/40" />
          <a
            href="/api/amfn/logout"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#03FF00] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </a>
        </div>
      </div>
    </header>
  );
}
