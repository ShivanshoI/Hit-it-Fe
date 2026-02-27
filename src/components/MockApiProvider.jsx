import React, { createContext, useState, useContext, useCallback } from 'react';

const MockApiContext = createContext();

export const useMockApi = () => useContext(MockApiContext);

export function MockApiProvider({ children }) {
  const [prompt, setPrompt] = useState(null);

  const mockApiHit = useCallback((method, endpoint, payload = null, dummySuccessData = null) => {
    // Fallback: If dummySuccessData is null, use payload (many simple endpoints just reflect it back)
    const successData = dummySuccessData !== null ? dummySuccessData : payload;

    // Only show popup in local development environment.
    if (!import.meta.env.DEV) {
      return new Promise(resolve => setTimeout(() => resolve(successData), 300));
    }

    return new Promise((resolve, reject) => {
      setPrompt({
        endpoint,
        method,
        payload,
        onSuccess: () => {
          setPrompt(null);
          setTimeout(() => resolve(successData), 200);
        },
        onFail: () => {
          setPrompt(null);
          setTimeout(() => reject(new Error(`API Error: ${method} ${endpoint}`)), 200);
        }
      });
    });
  }, []);

  return (
    <MockApiContext.Provider value={{ mockApiHit }}>
      {children}
      {prompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 999999
        }}>
          <div style={{
            background: '#1e1e24', padding: '24px', borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', width: '380px', maxWidth: '90vw',
            border: '1px solid #3f3f46', color: '#fff', fontFamily: 'system-ui, sans-serif',
            display: 'flex', flexDirection: 'column', maxHeight: '90vh'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', padding: '3px 8px', background: '#3b82f6', borderRadius: '4px', fontWeight: 'bold' }}>{prompt.method}</span>
              API Hit Intercepted
            </h3>
            
            <div style={{
              marginBottom: '16px', fontSize: '13px', color: '#a1a1aa',
              wordBreak: 'break-all', background: '#000', padding: '8px', borderRadius: '6px', fontFamily: 'monospace', flexShrink: 0
            }}>
              {prompt.endpoint}
            </div>

            {prompt.payload !== null && prompt.payload !== undefined && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Payload
                </span>
                <pre style={{
                  margin: 0, background: '#000', padding: '10px 12px', borderRadius: '6px',
                  fontSize: '11.5px', color: '#10b981', overflowY: 'auto', fontFamily: 'monospace',
                  border: '1px solid #27272a'
                }}>
                  {typeof prompt.payload === 'object' ? JSON.stringify(prompt.payload, null, 2) : String(prompt.payload)}
                </pre>
              </div>
            )}

            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#e4e4e7', flexShrink: 0 }}>Simulate success or failure?</p>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={prompt.onFail} style={{
                flex: 1, padding: '10px', background: '#ef4444',
                color: '#fff', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontWeight: 'bold'
              }}>
                Fail (500)
              </button>
              <button onClick={prompt.onSuccess} style={{
                flex: 1, padding: '10px', background: '#10b981',
                color: '#fff', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontWeight: 'bold'
              }}>
                Success (200)
              </button>
            </div>
          </div>
        </div>
      )}
    </MockApiContext.Provider>
  );
}

