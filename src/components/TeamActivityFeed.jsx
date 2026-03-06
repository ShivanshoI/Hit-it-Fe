import { useState, useRef, useEffect, useCallback } from 'react';
import { useTeam } from '../context/TeamContext';
import { getTeamFeed, getTeamMembers, sendTeamMessage, resolveTeamIssue } from '../api/teams.api';
import './TeamActivityFeed.css';

// Helper to render @mentions in messages
function renderMessage(text) {
  const parts = text.split(/(@\w[\w\s]*?\b)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? <span key={i} className="taf-mention">{part}</span> : part
  );
}

function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function TeamActivityFeed({ onClose }) {
  const { activeTeam, teamId } = useTeam();

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [msgType, setMsgType] = useState('message'); // 'message' | 'issue'
  const [input, setInput] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [loadingFeed, setLoadingFeed] = useState(true);

  // @Mention state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Load feed + members from real API
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingFeed(true);
        const [feedData, memberData] = await Promise.all([
          getTeamFeed(teamId),
          getTeamMembers(teamId),
        ]);
        if (!cancelled) {
          const feedArr = Array.isArray(feedData) ? feedData : (feedData?.data || []);
          setMessages(feedArr);
          setMembers(Array.isArray(memberData) ? memberData : []);
        }
      } catch (err) {
        console.error('Failed to load team feed:', err);
      } finally {
        if (!cancelled) setLoadingFeed(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [teamId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Filtered mention results
  const mentionResults = mentionQuery !== null
    ? members.filter(m =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setMentionQuery('');
      setMentionIdx(0);
    } else if (lastAt !== -1) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ') || after.length < 20) {
        setMentionQuery(after);
        setMentionIdx(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member) => {
    const lastAt = input.lastIndexOf('@');
    const before = input.slice(0, lastAt);
    setInput(`${before}@${member.name} `);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx(i => (i + 1) % mentionResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx(i => (i - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIdx]);
        return;
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    if (msgType === 'issue' && !issueTitle.trim()) return;

    // Extract mentioned user ids
    const mentionedIds = members
      .filter(m => input.includes(`@${m.name}`))
      .map(m => m.id);

    const payload = {
      type: msgType,
      message: input.trim(),
      ...(msgType === 'issue' ? { title: issueTitle.trim() } : {}),
      mentions: mentionedIds,
    };

    try {
      const newMsg = await sendTeamMessage(teamId, payload);
      setMessages(prev => [...prev, newMsg]);
      setInput('');
      setIssueTitle('');
      setMentionQuery(null);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [input, msgType, issueTitle, members, teamId]);

  const handleResolve = useCallback(async (feedId) => {
    try {
      await resolveTeamIssue(teamId, feedId);
      setMessages(prev => prev.map(m =>
        m.id === feedId ? { ...m, resolved: true } : m
      ));
    } catch (err) {
      console.error('Failed to resolve issue:', err);
    }
  }, [teamId]);

  if (!activeTeam) return null;

  return (
    <aside className="taf-sidebar">
      <div className="taf-header">
        <h3>
          <span className="taf-header-dot" />
          Team Feed
        </h3>
        <button className="taf-close" onClick={onClose} title="Close feed">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="taf-messages" ref={scrollRef}>
        {loadingFeed ? (
          <div className="taf-empty">
            <div className="taf-empty-icon" style={{ animation: 'spin 1s linear infinite' }}>⟳</div>
            <p>Loading feed...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="taf-empty">
            <div className="taf-empty-icon">💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id} className="taf-msg" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="taf-msg-header">
                <div className="taf-msg-avatar">{msg.user_name[0]}</div>
                <span className="taf-msg-name">{msg.user_name}</span>
                <span className="taf-msg-time">{timeAgo(msg.created_at)}</span>
              </div>

              {msg.type === 'issue' ? (
                <div className={`taf-issue ${msg.resolved ? 'taf-issue--resolved' : ''}`}>
                  <div className="taf-issue-title">
                    <span className={`taf-issue-badge ${msg.resolved ? 'taf-issue-badge--resolved' : 'taf-issue-badge--open'}`}>
                      {msg.resolved ? '✓ Resolved' : '⚠ Issue'}
                    </span>
                    {msg.title}
                  </div>
                  <div className="taf-issue-body">{renderMessage(msg.message)}</div>
                  {!msg.resolved && (
                    <button className="taf-issue-resolve" onClick={() => handleResolve(msg.id)}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              ) : (
                <div className="taf-msg-body">{renderMessage(msg.message)}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="taf-composer">
        <div className="taf-compose-type">
          <button
            className={`taf-type-btn ${msgType === 'message' ? 'active' : ''}`}
            onClick={() => setMsgType('message')}
          >
            💬 Message
          </button>
          <button
            className={`taf-type-btn ${msgType === 'issue' ? 'active' : ''}`}
            onClick={() => setMsgType('issue')}
          >
            ⚠ Issue
          </button>
        </div>

        {msgType === 'issue' && (
          <input
            className="taf-title-input"
            placeholder="Issue title..."
            value={issueTitle}
            onChange={e => setIssueTitle(e.target.value)}
          />
        )}

        <div className="taf-compose-row" style={{ position: 'relative' }}>
          {/* @Mention popup */}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="taf-mention-popup">
              {mentionResults.map((m, i) => (
                <button
                  key={m.id}
                  className={`taf-mention-item ${i === mentionIdx ? 'active' : ''}`}
                  onClick={() => insertMention(m)}
                  onMouseEnter={() => setMentionIdx(i)}
                >
                  <span className="taf-mention-item-avatar">{m.name[0]}</span>
                  <span>{m.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>{m.email}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            className="taf-compose-input"
            placeholder={`Type a ${msgType}... use @ to mention`}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="taf-send-btn"
            disabled={!input.trim() || (msgType === 'issue' && !issueTitle.trim())}
            onClick={handleSend}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
