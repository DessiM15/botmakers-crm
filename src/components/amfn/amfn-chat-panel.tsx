"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, X, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AmfnChatMessage } from "./amfn-chat-message";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What's in the brand guidelines?",
  "Summarize the editorial calendar",
  "What are the KPI targets?",
  "Explain the compliance workflow",
];

export function AmfnChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError("");
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/amfn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to get a response.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating button — neon green with glow */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#03FF00] hover:bg-[#03FF00]/90 text-[#0a0e1a] px-4 py-3 rounded-full shadow-lg shadow-[#03FF00]/20 transition-all duration-200 hover:scale-105 amfn-btn-shine"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-semibold hidden sm:inline">Ask AI</span>
        </button>
      )}

      {/* Chat sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-md bg-[#0a0e1a] border-white/[0.06] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-transparent" style={{
            borderImage: "linear-gradient(90deg, transparent, rgba(3,255,0,0.15), transparent) 1",
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#03FF00]/10 border border-[#03FF00]/20">
                  <Bot className="h-4 w-4 text-[#03FF00]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-white text-base">
                      Document Assistant
                    </SheetTitle>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#03FF00]/10 text-[#03FF00] border border-[#03FF00]/20 uppercase tracking-wider">
                      AI
                    </span>
                  </div>
                  <SheetDescription className="text-gray-500 text-xs">
                    Ask questions about your deliverable package
                  </SheetDescription>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-[#03FF00] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#03FF00]/10 border border-[#03FF00]/20 mb-4">
                  <Bot className="h-6 w-6 text-[#03FF00]" />
                </div>
                <p className="text-sm text-gray-400 mb-1">
                  Ask me anything about your documents
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  I can help with brand guidelines, editorial calendar, KPIs, market intelligence, and more.
                </p>

                {/* Suggested question pills */}
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1.5 hover:bg-[#03FF00]/10 hover:text-[#03FF00] hover:border-[#03FF00]/20 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <AmfnChatMessage key={i} role={msg.role} content={msg.content} />
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#03FF00]/10 border border-[#03FF00]/20 flex items-center justify-center">
                  <Loader2 className="h-3.5 w-3.5 text-[#03FF00] animate-spin" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#03FF00] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#03FF00] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#03FF00] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 pb-2">
              <p className="text-xs text-red-400 bg-red-400/5 border-l-2 border-red-400 rounded-r-lg px-3 py-2">
                {error}
              </p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-transparent px-4 py-3" style={{
            borderImage: "linear-gradient(90deg, transparent, rgba(3,255,0,0.1), transparent) 1",
          }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the documents..."
                rows={1}
                className="flex-1 resize-none bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#03FF00]/20 max-h-32"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                size="sm"
                className="h-10 w-10 bg-[#03FF00] hover:bg-[#03FF00]/90 text-[#0a0e1a] rounded-xl p-0 flex-shrink-0 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
