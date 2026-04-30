import React, { useState, useEffect, useRef } from 'react'

const AGENTS = [
  { id: 'gpt4',    name: 'GPT-4o',   color: '#4F46E5' },
  { id: 'gemini',  name: 'Gemini',   color: '#10B981' },
  { id: 'claude',  name: 'Claude',   color: '#F59E0B' },
  { id: 'deepseek',name: 'DeepSeek', color: '#3B82F6' },
  { id: 'mistral', name: 'Mistral',  color: '#EF4444' },
]

// ─── Styles ────────────────────────────────────────────────────────────────

const S = {
  root:       { display:'flex', fontFamily:'sans-serif', background:'#111', color:'#fff', minHeight:'100vh', height:'100vh', overflow:'hidden' },
  main:       { flex:1, display:'flex', flexDirection:'column', padding:'1.5rem', minWidth:0 },
  heading:    { fontSize:'1.8rem', margin:'0 0 1rem 0' },
  chatLog:    { flex:1, overflowY:'auto', marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' },
  entry:      { padding:'1rem', background:'#222', borderRadius:'8px' },
  youLabel:   { fontWeight:'bold', marginBottom:'0.25rem' },
  agentRow:   { marginTop:'0.5rem', lineHeight:'1.5' },
  inputRow:   { display:'flex', gap:'0.5rem' },
  input:      { flex:1, padding:'0.65rem 0.9rem', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:'6px', fontSize:'1rem', outline:'none' },
  sendBtn:    (disabled) => ({
    padding:'0.65rem 1.25rem', background: disabled ? '#333' : '#4F46E5',
    color:'#fff', border:'none', borderRadius:'6px', cursor: disabled ? 'default' : 'pointer', fontSize:'1rem',
  }),

  // Sidebar
  sidebar:    { width:'300px', minWidth:'300px', background:'#16162a', borderLeft:'1px solid #2a2a44', display:'flex', flexDirection:'column', padding:'1.25rem', gap:'0.75rem' },
  sideHead:   { display:'flex', justifyContent:'space-between', alignItems:'center', margin:0 },
  sideTitle:  { fontSize:'1rem', fontWeight:'bold', margin:0 },
  pill:       (bg, fg='#fff') => ({ padding:'0.2rem 0.65rem', background:bg, color:fg, border:'none', borderRadius:'999px', cursor:'pointer', fontSize:'0.75rem' }),
  blurb:      { color:'#888', fontSize:'0.85rem', lineHeight:'1.5', margin:0 },
  connectBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', padding:'0.6rem 1rem', background:'#4285F4', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'0.9rem' },
  select:     { padding:'0.4rem 0.6rem', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:'4px', fontSize:'0.85rem' },
  addRow:     { display:'flex', gap:'0.5rem' },
  addInput:   { flex:1, padding:'0.45rem 0.65rem', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:'4px', fontSize:'0.85rem', outline:'none' },
  addBtn:     { padding:'0.45rem 0.75rem', background:'#4285F4', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'1rem', lineHeight:1 },
  taskList:   { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.4rem' },
  taskRow:    (done) => ({
    display:'flex', alignItems:'center', gap:'0.5rem',
    padding:'0.45rem 0.6rem', background:'#222', borderRadius:'4px',
  }),
  taskTitle:  (done) => ({ flex:1, fontSize:'0.85rem', textDecoration: done ? 'line-through' : 'none', color: done ? '#666' : '#ddd' }),
  delBtn:     { background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'1.1rem', lineHeight:1, padding:'0 0.15rem' },
  muted:      { color:'#666', fontSize:'0.82rem', textAlign:'center', padding:'1rem 0' },
  tasksBadge: { fontSize:'0.7rem', background:'#2a2a44', color:'#8888cc', padding:'0.1rem 0.5rem', borderRadius:'999px' },
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function App() {
  const [chatLog,       setChatLog]       = useState([])
  const [userInput,     setUserInput]     = useState('')
  const [loading,       setLoading]       = useState(false)
  const [authed,        setAuthed]        = useState(false)
  const [taskLists,     setTaskLists]     = useState([])
  const [selectedList,  setSelectedList]  = useState('@default')
  const [tasks,         setTasks]         = useState([])
  const [tasksLoading,  setTasksLoading]  = useState(false)
  const [newTask,       setNewTask]       = useState('')
  const chatEndRef = useRef(null)

  // ── Scroll chat to bottom on new messages
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatLog])

  // ── On mount: check OAuth redirect or stored auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', '/')
      setAuthed(true)
      refreshTasks('@default')
      fetchTaskLists()
    } else {
      fetch('/api/auth/status')
        .then(r => r.json())
        .then(d => {
          setAuthed(d.authenticated)
          if (d.authenticated) { refreshTasks('@default'); fetchTaskLists() }
        })
        .catch(() => {})
    }
  }, [])

  // ── Auth
  const connectGoogle = async () => {
    const res  = await fetch('/api/auth/google')
    const data = await res.json()
    window.location.href = data.auth_url
  }

  const disconnectGoogle = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthed(false)
    setTasks([])
    setTaskLists([])
  }

  // ── Task lists
  const fetchTaskLists = async () => {
    try {
      const res  = await fetch('/api/tasks/lists')
      const data = await res.json()
      setTaskLists(data)
    } catch (_) {}
  }

  // ── Tasks CRUD
  const refreshTasks = async (listId = selectedList) => {
    setTasksLoading(true)
    try {
      const res  = await fetch(`/api/tasks?tasklist_id=${encodeURIComponent(listId)}`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (_) {
      setTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask.trim(), tasklist_id: selectedList }),
      })
      setNewTask('')
      refreshTasks(selectedList)
    } catch (_) {}
  }

  const toggleTask = async (task) => {
    const status = task.status === 'completed' ? 'needsAction' : 'completed'
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, tasklist_id: selectedList }),
      })
      refreshTasks(selectedList)
    } catch (_) {}
  }

  const deleteTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}?tasklist_id=${encodeURIComponent(selectedList)}`, { method: 'DELETE' })
      refreshTasks(selectedList)
    } catch (_) {}
  }

  // ── Chat
  const handleSubmit = async () => {
    if (!userInput.trim() || loading) return
    const prompt = userInput.trim()
    setUserInput('')
    setLoading(true)
    try {
      const res    = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const result = await res.json()
      setChatLog(prev => [...prev, { user: prompt, agents: result }])
      if (authed) refreshTasks(selectedList)
    } catch (e) {
      setChatLog(prev => [...prev, { user: prompt, agents: { error: `[Network error] ${e.message}` } }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const pendingCount = tasks.filter(t => t.status !== 'completed').length

  // ── Render
  return (
    <div style={S.root}>

      {/* ── Chat panel ── */}
      <div style={S.main}>
        <h1 style={S.heading}>🧠 LEGION</h1>

        <div style={S.chatLog}>
          {chatLog.length === 0 && (
            <p style={{ color:'#555', margin:'auto', textAlign:'center' }}>Ask the council anything…</p>
          )}
          {chatLog.map((entry, i) => (
            <div key={i} style={S.entry}>
              <div style={S.youLabel}>You</div>
              <div style={{ color:'#ccc', marginBottom:'0.5rem' }}>{entry.user}</div>
              {Object.entries(entry.agents).map(([id, res]) => {
                const agent = AGENTS.find(a => a.id === id)
                return (
                  <div key={id} style={S.agentRow}>
                    <strong style={{ color: agent?.color ?? '#aaa' }}>{agent?.name ?? id}:</strong>
                    {' '}{res}
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div style={S.inputRow}>
          <input
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask the council…"
            style={S.input}
            disabled={loading}
          />
          <button onClick={handleSubmit} disabled={loading} style={S.sendBtn(loading)}>
            {loading ? '…' : 'Ask'}
          </button>
        </div>
      </div>

      {/* ── Google Tasks sidebar ── */}
      <div style={S.sidebar}>
        <div style={S.sideHead}>
          <span style={S.sideTitle}>
            📋 Google Tasks
            {authed && pendingCount > 0 && (
              <span style={{ ...S.tasksBadge, marginLeft:'0.5rem' }}>{pendingCount}</span>
            )}
          </span>
          {authed && (
            <button onClick={disconnectGoogle} style={S.pill('#2a2a44', '#888')}>
              Disconnect
            </button>
          )}
        </div>

        {!authed ? (
          <>
            <p style={S.blurb}>
              Connect Google Tasks so the council can see your work and help you prioritise.
            </p>
            <button onClick={connectGoogle} style={S.connectBtn}>
              🔗 Connect Google Tasks
            </button>
          </>
        ) : (
          <>
            {/* List selector */}
            {taskLists.length > 1 && (
              <select
                style={S.select}
                value={selectedList}
                onChange={e => { setSelectedList(e.target.value); refreshTasks(e.target.value) }}
              >
                {taskLists.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            )}

            {/* Add task */}
            <div style={S.addRow}>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="New task…"
                style={S.addInput}
              />
              <button onClick={addTask} style={S.addBtn}>+</button>
            </div>

            {/* Task list */}
            <div style={S.taskList}>
              {tasksLoading ? (
                <p style={S.muted}>Loading…</p>
              ) : tasks.length === 0 ? (
                <p style={S.muted}>No tasks yet. Add one above!</p>
              ) : (
                tasks.map(task => {
                  const done = task.status === 'completed'
                  return (
                    <div key={task.id} style={S.taskRow(done)}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleTask(task)}
                        style={{ cursor:'pointer', accentColor:'#4285F4' }}
                      />
                      <span style={S.taskTitle(done)}>{task.title}</span>
                      <button onClick={() => deleteTask(task.id)} style={S.delBtn} title="Delete">×</button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
