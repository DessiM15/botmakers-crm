import { Bot, User } from "lucide-react";

interface AmfnChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function AmfnChatMessage({ role, content }: AmfnChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 amfn-fade-up ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-[#03FF00]/20 text-[#03FF00]"
            : "bg-[#03FF00]/10 border border-[#03FF00]/20 text-[#03FF00]"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[#03FF00] text-[#0a0e1a]"
            : "bg-white/[0.02] border-l-2 border-[#03FF00]/30 text-gray-300"
        }`}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}
