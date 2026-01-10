import React, { createContext, useContext, useState } from "react";

interface MantoContextType {
  isOpen: boolean;
  openManto: () => void;
  closeManto: () => void;
  toggleManto: () => void;
}

const MantoContext = createContext<MantoContextType | undefined>(undefined);

export function MantoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openManto = () => setIsOpen(true);
  const closeManto = () => setIsOpen(false);
  const toggleManto = () => setIsOpen(prev => !prev);

  return (
    <MantoContext.Provider value={{ isOpen, openManto, closeManto, toggleManto }}>
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
