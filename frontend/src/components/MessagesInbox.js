import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Send, X, User, Users, UserCog } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MessagesInbox = ({ onClose }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  // Compose form
  const [composeData, setComposeData] = useState({
    recipient_type: 'individual',
    recipient_id: '',
    recipient_role: '',
    subject: '',
    content: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [messagesRes, colleaguesRes] = await Promise.all([
        axios.get(`${API}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/employees`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { employees: [] } }))
      ]);
      setMessages(messagesRes.data.messages || []);
      setColleagues(colleaguesRes.data.employees?.filter(e => e.id !== user?.id) || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        subject: composeData.subject,
        content: composeData.content,
        message_type: 'general'
      };
      
      if (composeData.recipient_type === 'individual') {
        payload.recipient_id = composeData.recipient_id;
      } else if (composeData.recipient_type === 'role') {
        payload.recipient_role = composeData.recipient_role;
      }
      
      await axios.post(`${API}/messages`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowCompose(false);
      setComposeData({ recipient_type: 'individual', recipient_id: '', recipient_role: '', subject: '', content: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message');
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const inboxMessages = messages.filter(m => m.recipient_id === user?.id || m.recipient_id === null);
  const sentMessages = messages.filter(m => m.sender_id === user?.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'inbox' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
            }`}
          >
            Inbox ({inboxMessages.length})
          </button>
          <button
            onClick={() => { setActiveTab('sent'); setSelectedMessage(null); }}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'sent' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
            }`}
          >
            Sent ({sentMessages.length})
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            + Compose
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Message List */}
          <div className={`${selectedMessage ? 'w-1/3' : 'w-full'} border-r border-gray-200 overflow-y-auto`}>
            {loading ? (
              <div className="p-4 text-center"><div className="frappe-spinner mx-auto"></div></div>
            ) : (
              <>
                {(activeTab === 'inbox' ? inboxMessages : sentMessages).length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No messages</div>
                ) : (
                  (activeTab === 'inbox' ? inboxMessages : sentMessages).map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedMessage?.id === msg.id ? 'bg-blue-50' : ''
                      } ${!msg.read_by?.includes(user?.id) && activeTab === 'inbox' ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {activeTab === 'inbox' ? msg.sender_name : (msg.recipient_id ? 'Direct Message' : 'Broadcast')}
                        </span>
                        <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{msg.subject}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">{msg.content}</p>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          {/* Message Detail */}
          {selectedMessage && (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedMessage.subject}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <span>From: {selectedMessage.sender_name}</span>
                  <span>•</span>
                  <span>{formatTime(selectedMessage.created_at)}</span>
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>
            </div>
          )}
        </div>

        {/* Compose Modal */}
        {showCompose && (
          <div className="absolute inset-0 bg-white rounded-lg flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Message</h3>
              <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="flex-1 flex flex-col p-4">
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Send to</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setComposeData({ ...composeData, recipient_type: 'individual' })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        composeData.recipient_type === 'individual' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <User size={16} />
                      <span className="text-sm">Individual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeData({ ...composeData, recipient_type: 'role' })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        composeData.recipient_type === 'role' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <Users size={16} />
                      <span className="text-sm">By Role</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeData({ ...composeData, recipient_type: 'all' })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        composeData.recipient_type === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <UserCog size={16} />
                      <span className="text-sm">All Staff</span>
                    </button>
                  </div>
                  
                  {composeData.recipient_type === 'individual' && (
                    <select
                      value={composeData.recipient_id}
                      onChange={(e) => setComposeData({ ...composeData, recipient_id: e.target.value })}
                      className="frappe-input"
                      required
                    >
                      <option value="">Select recipient...</option>
                      {colleagues.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.first_name} {c.last_name} ({c.job_title})
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {composeData.recipient_type === 'role' && (
                    <select
                      value={composeData.recipient_role}
                      onChange={(e) => setComposeData({ ...composeData, recipient_role: e.target.value })}
                      className="frappe-input"
                      required
                    >
                      <option value="">Select role...</option>
                      <option value="staff">All Staff</option>
                      <option value="manager">Managers</option>
                      <option value="admin">Administrators</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                    className="frappe-input"
                    placeholder="Message subject"
                    required
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={composeData.content}
                    onChange={(e) => setComposeData({ ...composeData, content: e.target.value })}
                    className="frappe-input h-40"
                    placeholder="Type your message..."
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="frappe-btn frappe-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="frappe-btn frappe-btn-primary flex-1">
                  <Send size={16} />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesInbox;
