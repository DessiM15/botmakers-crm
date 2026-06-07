import { redirect } from "next/navigation";
import { isAmfnAuthenticated } from "@/lib/amfn/auth";
import { AmfnLoginForm } from "@/components/amfn/amfn-login-form";
import Image from "next/image";

export default async function AmfnLoginPage() {
  const authenticated = await isAmfnAuthenticated();
  if (authenticated) {
    redirect("/amfn/portal");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo with floating animation and glow ring */}
        <div className="flex flex-col items-center space-y-6 amfn-fade-up">
          <div className="relative amfn-float">
            {/* Pulsing glow ring behind logo */}
            <div className="absolute inset-0 -m-3 rounded-full bg-[#03FF00]/10 blur-xl amfn-glow-pulse" />
            <div className="relative w-20 h-20">
              <Image
                src="/amfn/american-fusion-logo.png"
                alt="American Fusion"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              American Fusion Inc.
            </h1>
            {/* Secure Portal status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-[#03FF00] amfn-status-pulse" />
                <span className="relative rounded-full h-2 w-2 bg-[#03FF00]" />
              </span>
              <span className="text-xs text-gray-400 tracking-wide uppercase">
                Secure Portal
              </span>
            </div>
          </div>
        </div>

        {/* Login card with animated gradient border */}
        <div className="amfn-fade-up amfn-delay-200 amfn-border-glow rounded-2xl">
          <div className="bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-8">
            <AmfnLoginForm />
          </div>
        </div>

        {/* BotMakers footer */}
        <div className="amfn-fade-up amfn-delay-400 flex items-center justify-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-[#03FF00] text-[#0a0e1a]">
            <span className="text-[10px] font-bold">b.</span>
          </div>
          <p className="text-xs text-gray-600">
            Powered by BotMakers Inc.
          </p>
        </div>
      </div>
    </div>
  );
}
