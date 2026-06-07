import { redirect } from "next/navigation";
import { isAmfnAuthenticated } from "@/lib/amfn/auth";
import { AmfnHeader } from "@/components/amfn/amfn-header";
import { AmfnFooter } from "@/components/amfn/amfn-footer";
import { AmfnDocumentGrid } from "@/components/amfn/amfn-document-grid";
import { AmfnChatPanel } from "@/components/amfn/amfn-chat-panel";
import { FileText, Files, Layers, Shield, Clock } from "lucide-react";

const QUICK_STATS = [
  { label: "Documents", value: "8", icon: Files },
  { label: "Categories", value: "5", icon: Layers },
  { label: "Access Level", value: "Full", icon: Shield },
  { label: "Last Updated", value: "May 2026", icon: Clock },
] as const;

export default async function AmfnPortalPage() {
  const authenticated = await isAmfnAuthenticated();
  if (!authenticated) {
    redirect("/amfn");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AmfnHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title with icon */}
        <div className="amfn-fade-up space-y-2 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#03FF00]/10 border border-[#03FF00]/20">
              <FileText className="h-5 w-5 text-[#03FF00]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Document Portal
              </h1>
            </div>
          </div>
          <p className="text-gray-400 ml-[52px]">
            Your complete deliverable package from BotMakers Inc. — foundation documents,
            editorial calendar, content, compliance workflows, KPIs, and market intelligence.
          </p>
        </div>

        {/* Quick Stats Row */}
        <div className="amfn-fade-up amfn-delay-200 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {QUICK_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#03FF00]/10">
                <stat.icon className="h-4 w-4 text-[#03FF00]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-sm font-semibold text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Gradient divider */}
        <div className="amfn-fade-up amfn-delay-300 mb-8">
          <div
            className="h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(3,255,0,0.15), transparent)",
            }}
          />
        </div>

        {/* Document grid */}
        <div className="amfn-fade-up amfn-delay-400">
          <AmfnDocumentGrid />
        </div>
      </main>
      <AmfnFooter />
      <AmfnChatPanel />
    </div>
  );
}
