import { create } from 'zustand';

export const useChatStore = create((set) => ({
  messages: [
    { 
      sender: 'ai', 
      text: "Hello! I'm the Analytics AI Hub Matchmaker. Describe what business problem or pain point you're trying to solve, and I'll search our team's arsenal to suggest the best tool. If we don't have it, I'll guide you to create it!" 
    }
  ],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ 
    messages: [
      { 
        sender: 'ai', 
        text: "Hello! I'm the Analytics AI Hub Matchmaker. Describe what business problem or pain point you're trying to solve, and I'll search our team's arsenal to suggest the best tool. If we don't have it, I'll guide you to create it!" 
      }
    ]
  }),
}));
