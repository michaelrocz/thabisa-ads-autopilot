import { useState } from 'react';

export default function AICommandCenter() {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState([]);
  const [loading, setLoading] = useState(false);

  const executeCommand = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate/Call our new AI Command API
    try {
      const response = await fetch('/api/ai-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: command })
      });
      const data = await response.json();
      setOutput(prev => [...prev, { type: 'user', text: command }, { type: 'ai', text: data.result }]);
    } catch (err) {
      setOutput(prev => [...prev, { type: 'error', text: "Failed to reach Autopilot Engine." }]);
    }
    
    setCommand('');
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-2xl h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
        Autopilot Command Terminal
      </h2>
      
      <div className="flex-1 overflow-y-auto mb-4 bg-black/50 p-4 rounded-lg font-mono text-sm">
        {output.length === 0 && (
          <p className="text-slate-500">Ready for commands. Try: "Show latest results" or "Create campaign for Runners"</p>
        )}
        {output.map((line, i) => (
          <div key={i} className={`mb-2 ${line.type === 'user' ? 'text-blue-400' : line.type === 'error' ? 'text-red-500' : 'text-green-400'}`}>
            <span className="opacity-50">{line.type === 'user' ? '>' : '#'}</span> {line.text}
          </div>
        ))}
      </div>

      <form onSubmit={executeCommand} className="flex gap-2">
        <input 
          type="text" 
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type command to the Autopilot..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
        <button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-bold transition-all disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Executing...' : 'SEND'}
        </button>
      </form>
    </div>
  );
}
