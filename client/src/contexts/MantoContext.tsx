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

  const openManto = useCallback(() => {
    // #region agent log H5
    fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/src/contexts/MantoContext.tsx:openManto',message:'openManto called',data:{nextIsOpen:true},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion agent log H5
    setIsOpen(true);
  }, []);
  const closeManto = useCallback(() => {
    // #region agent log H5
    fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/src/contexts/MantoContext.tsx:closeManto',message:'closeManto called',data:{nextIsOpen:false},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion agent log H5
    setIsOpen(false);
  }, []);
  const toggleManto = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      // #region agent log H5
      fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client/src/contexts/MantoContext.tsx:toggleManto',message:'toggleManto called',data:{prevIsOpen:prev,nextIsOpen:next},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion agent log H5
      return next;
    });
  }, []);

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
