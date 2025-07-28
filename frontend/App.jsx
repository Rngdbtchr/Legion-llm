
import React, { useState } from 'react'

const agents = [
  { id: "gpt4", name: "GPT-4o", color: "#4F46E5" },
  { id: "gemini", name: "Gemini", color: "#10B981" },
  { id: "claude", name: "Claude", color: "#F59E0B" },
  { id: "deepseek", name: "DeepSeek", color: "#3B82F6" },
  { id: "mistral", name: "Mistral", color: "#EF4444" }
]

export default function App() {
  const [chatLog, setChatLog] = useState([])
  const [userInput, setUserInput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!userInput.trim()) return
    setLoading(true)

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userInput })
    })
    const result = await response.json()

    setChatLog(prev => [...prev, { user: userInput, agents: result }])
    setUserInput("")
    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#111', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧠 LEGION</h1>
      <div style={{ marginBottom: '1rem' }}>
        {chatLog.map((entry, i) => (
          <div key={i} style={{ marginBottom: '1rem', padding: '1rem', background: '#222' }}>
            <strong>You:</strong> {entry.user}
            {Object.entries(entry.agents).map(([id, res]) => {
              const agent = agents.find(a => a.id === id)
              return (
                <div key={id} style={{ marginTop: '0.5rem' }}>
                  <strong style={{ color: agent?.color }}>{agent?.name}:</strong> <span style={{ marginLeft: '1rem' }}>{res}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div>
        <input
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          placeholder="Ask the council..."
          style={{ padding: '0.5rem', width: '80%' }}
        />
        <button onClick={handleSubmit} disabled={loading} style={{ marginLeft: '0.5rem', padding: '0.5rem' }}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>
    </div>
  )
}
