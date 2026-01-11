import React, { createContext, useContext, useState, useCallback } from "react";

/**
 * Chat message type for the Manto assistant
 */
export interface MantoMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MantoContextType {
  isOpen: boolean;
  openManto: () => void;
  closeManto: () => void;
  toggleManto: () => void;
  // Chat messages - persisted across navigation
  messages: MantoMessage[];
  addMessage: (message: Omit<MantoMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;
}

const MantoContext = createContext<MantoContextType | undefined>(undefined);

export function MantoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MantoMessage[]>([]);

  const openManto = useCallback(() => setIsOpen(true), []);
  const closeManto = useCallback(() => setIsOpen(false), []);
  const toggleManto = useCallback(() => setIsOpen((prev) => !prev), []);

  const addMessage = useCallback((message: Omit<MantoMessage, "id" | "timestamp">) => {
    const newMessage: MantoMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <MantoContext.Provider value={{ 
      isOpen, 
      openManto, 
      closeManto, 
      toggleManto,
      messages,
      addMessage,
      clearMessages,
    }}>
      {children}
    </MantoContext.Provider>
  );
}

export function useManto() {
  const context = useContext(MantoContext);
  if (!context) {
    throw new Error("useManto must be used within MantoProvider");
  }
  return context;
}
