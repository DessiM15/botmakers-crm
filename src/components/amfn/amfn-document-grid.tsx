"use client";

import { BookOpen, Calendar, ShieldCheck, BarChart3, Globe } from "lucide-react";
import { AMFN_CATEGORIES, AMFN_DOCUMENTS } from "@/lib/amfn/documents";
import { AmfnDocumentCard } from "./amfn-document-card";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Foundation Package": BookOpen,
  "Content & Editorial": Calendar,
  "Operations & Compliance": ShieldCheck,
  "Analytics & Performance": BarChart3,
  "Strategic Intelligence": Globe,
};

export function AmfnDocumentGrid() {
  return (
    <div className="space-y-10">
      {AMFN_CATEGORIES.map((category, catIndex) => {
        const docs = AMFN_DOCUMENTS.filter((d) => d.category === category);
        if (docs.length === 0) return null;

        const Icon = CATEGORY_ICONS[category] ?? BookOpen;

        return (
          <section key={category} className="amfn-fade-up" style={{ animationDelay: `${catIndex * 100}ms` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#03FF00]/10 border border-[#03FF00]/20">
                <Icon className="h-3.5 w-3.5 text-[#03FF00]" />
              </div>
              <h2 className="text-lg font-semibold text-white">{category}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] text-gray-400 font-medium">
                {docs.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc, docIndex) => (
                <div key={doc.id} className="amfn-fade-up" style={{ animationDelay: `${(catIndex * 100) + (docIndex * 80)}ms` }}>
                  <AmfnDocumentCard document={doc} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
