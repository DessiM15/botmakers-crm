export function AmfnFooter() {
  return (
    <footer
      className="border-t border-transparent py-6"
      style={{
        borderImage: "linear-gradient(90deg, transparent, rgba(3,255,0,0.1), transparent) 1",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-[#03FF00] text-[#0a0e1a]">
            <span className="text-[10px] font-bold">b.</span>
          </div>
          <span className="text-xs text-gray-500">
            Powered by BotMakers Inc.
          </span>
        </div>
        <span className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} American Fusion Inc. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
