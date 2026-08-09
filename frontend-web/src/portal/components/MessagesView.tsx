/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  SquarePen,
  Video,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Download,
  FileText,
  CheckCheck,
  Check,
  MessageSquare
} from "lucide-react";
import { Conversation, ChatMessage } from "../types";

interface MessagesProps {
  conversations: Conversation[];
  onSendMessage: (conversationId: string, text: string) => void;
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
}

export function MessagesView({
  conversations,
  onSendMessage,
  activeConversationId,
  onSelectConversation,
}: MessagesProps) {
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [searchContact, setSearchContact] = useState("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  // Auto scroll down thread whenever message list is updated
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, isTyping]);

  const handleSend = () => {
    if (!inputText.trim() || !activeConv) return;
    const textToSend = inputText.trim();
    onSendMessage(activeConv.id, textToSend);
    setInputText("");

    // Simulate smart tutor response after 1 to 2.5 seconds!
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);

      // Simple pre-cooked smart tutor replies
      const responses = [
        "That's exceptionally precise! Keep working on those derivatives.",
        "Excellent query. Remember that the chain rule says we compose the derivative of f(g(x)) * g'(x).",
        "Indeed. I will also be active during tomorrow's open hours at 4:30 PM if you need live queries.",
        "Exactly! Let me know if you would like me to compile some practice problems on integrals next week.",
        "You are welcome! Have a wonderfully productive study session this evening."
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];

      const lastMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "partner",
        text: randomReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      activeConv.messages.push(lastMsg);
      activeConv.lastMessage = randomReply;
      activeConv.lastMessageTime = lastMsg.timestamp;
      
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter contacts by sidebar search
  const filteredConversations = conversations.filter((c) =>
    c.partnerName.toLowerCase().includes(searchContact.toLowerCase())
  );

  return (
    <div className="font-sans select-none flex h-[calc(100vh-10rem)] border border-brand-border/30 rounded-3xl bg-white overflow-hidden shadow-sm">
      
      {/* Contact Conversations List Sidebar */}
      <div className="w-80 border-r border-brand-border/30 flex flex-col shrink-0 bg-brand-low/5">
        <div className="p-4 border-b border-brand-border/20 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-black text-lg text-brand-text">
              Messages
            </h2>
            <button
              onClick={() => {
                const name = prompt("Enter contact name to message:");
                if (name) alert(`Contacting ${name}...`);
              }}
              title="Compose message"
              className="p-2 hover:bg-brand-low rounded-xl transition-colors text-brand-primary cursor-pointer"
            >
              <SquarePen className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-variant/40 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              className="w-full bg-brand-low border border-brand-border/20 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-brand-primary outline-none focus:bg-white transition-colors"
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
            />
          </div>
        </div>

        {/* Contacts scrolling list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-brand-border/10">
          {filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConv?.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-4 flex gap-3 cursor-pointer transition-all border-l-4 ${
                  isSelected
                    ? "bg-brand-primary/5 border-brand-primary"
                    : "border-transparent hover:bg-brand-low/40"
                }`}
              >
                <div className="relative shrink-0 select-none">
                  <img
                    className="w-12 h-12 rounded-full object-cover"
                    src={conv.partnerAvatar}
                    alt={conv.partnerName}
                    referrerPolicy="no-referrer"
                  />
                  {conv.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-brand-text text-xs tracking-wide truncate">
                      {conv.partnerName}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-brand-text-variant/40">
                      {conv.lastMessageTime}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-1">
                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? "font-bold text-brand-primary" : "text-brand-text-variant/70"}`}>
                      {conv.lastMessage}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-brand-secondary text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-sm shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Thread Frame */}
      <div className="flex-1 flex flex-col bg-brand-low/5 relative">
        {activeConv ? (
          <>
            {/* Thread Header */}
            <header className="h-16 px-6 border-b border-brand-border/20 flex items-center justify-between bg-white z-10 shadow-sm shrink-0 select-none">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover"
                    src={activeConv.partnerAvatar}
                    alt={activeConv.partnerName}
                    referrerPolicy="no-referrer"
                  />
                  {activeConv.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-brand-text text-sm leading-none mb-1">
                    {activeConv.partnerName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-text-variant/60 font-semibold font-display tracking-wide">
                    <span className={activeConv.isOnline ? "text-emerald-600" : "text-brand-text-variant/50"}>
                      {activeConv.isOnline ? "Online" : "Away"}
                    </span>
                    <span>•</span>
                    <span>{activeConv.partnerRole}</span>
                  </div>
                </div>
              </div>

              {/* Call Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => alert(`Initiating video request dial towards ${activeConv.partnerName}...`)}
                  className="p-2 text-brand-text-variant hover:bg-brand-low rounded-xl transition-all cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  onClick={() => alert(`Dialing contact number: ${activeConv.partnerName}...`)}
                  className="p-2 text-brand-text-variant hover:bg-brand-low rounded-xl transition-all cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => alert(`Loading session call logs...`)}
                  className="p-2 text-brand-text-variant hover:bg-brand-low rounded-xl transition-all cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Scrolling Chat Thread Body */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
              <div className="flex justify-center select-none">
                <span className="bg-brand-container text-brand-primary text-[9px] uppercase font-black px-3 py-1 rounded-full font-display tracking-widest border border-brand-primary/10 select-none">
                  Today
                </span>
              </div>

              {activeConv.messages.map((message) => {
                const isUser = message.sender === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 max-w-[80%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                  >
                    {!isUser && (
                      <img
                        className="w-8 h-8 rounded-full self-end object-cover ring-1 ring-brand-primary/5 select-none shrink-0"
                        src={activeConv.partnerAvatar}
                        alt="Partner Avatar"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="space-y-1">
                      <div
                        className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed border ${
                          isUser
                            ? "bg-brand-primary text-white border-brand-primary/10 rounded-br-sm"
                            : "bg-white text-brand-text border-brand-border/20 rounded-bl-sm"
                        }`}
                      >
                        <p>{message.text}</p>

                        {/* Interactive File Attachment Attachment Widget */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.attachments.map((file, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 p-3 bg-brand-low/50 border border-brand-border/30 rounded-xl"
                              >
                                <div className="w-9 h-9 bg-brand-error/10 text-brand-error rounded-lg flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5 shrink-0" />
                                </div>
                                <div className="flex-1 min-w-0 select-none">
                                  <p className="text-xs font-bold text-brand-text truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-[10px] text-brand-text-variant/60">
                                    {file.size}
                                  </p>
                                </div>
                                <button
                                  onClick={() => alert(`Starting download of file attachment: ${file.name}`)}
                                  className="p-1.5 hover:bg-brand-container rounded-lg transition-colors text-brand-primary shrink-0 cursor-pointer"
                                  title="Download asset"
                                >
                                  <Download className="w-4 h-4 shrink-0" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={`flex items-center gap-1.5 px-1 select-none ${isUser ? "justify-end" : ""}`}>
                        <span className="text-[9px] font-bold text-brand-text-variant/40">
                          {message.timestamp}
                        </span>
                        {isUser && (
                          <CheckCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Dynamic Simulated typing indicator */}
              {isTyping && (
                <div className="flex gap-2 items-center text-brand-text-variant select-none animate-pulse">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-[10px] font-bold italic text-brand-secondary">
                    {activeConv.partnerName} is typing...
                  </span>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>

            {/* Input Message Footer */}
            <footer className="p-4 bg-white border-t border-brand-border/20 shrink-0 select-none">
              <div className="max-w-4xl mx-auto flex items-center gap-3 bg-brand-low border border-brand-border/30 rounded-2xl p-2 focus-within:border-brand-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-primary/10 transition-all">
                <button
                  onClick={() => alert("Upload dialog opened: select homework, slides or certification PDFs...")}
                  className="p-2 text-brand-text-variant hover:text-brand-primary transition-colors cursor-pointer shrink-0"
                  title="Attach file"
                >
                  <Paperclip className="w-4 h-4 shrink-0" />
                </button>
                <button
                  onClick={() => alert("Emoji drawer opened...")}
                  className="p-2 text-brand-text-variant hover:text-brand-primary transition-colors cursor-pointer shrink-0"
                  title="Add emoji"
                >
                  <Smile className="w-4 h-4 shrink-0" />
                </button>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-sans placeholder:text-brand-text-variant/40 outline-none text-brand-text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
                <button
                  onClick={handleSend}
                  className="bg-brand-secondary text-white p-2.5 rounded-xl flex items-center justify-center hover:bg-brand-secondary-hover active:scale-90 transition-all shadow-md shrink-0 cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-brand-low/5 p-12 text-center text-brand-text-variant/60">
            <MessageSquare className="w-12 h-12 text-brand-border/70 mb-4 animate-bounce" />
            <h3 className="font-display font-black text-sm text-brand-text">Select a conversation</h3>
            <p className="text-xs max-w-xs mt-1">
              Select any contact on the left to review your private real-time message history with tutors and students.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
