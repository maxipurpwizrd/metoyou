import { useMemo, useState } from 'react';
import VibesProMessage from './VibesProMessage';
import VibesProInput from './VibesProInput';
import VibesProFalconSend from './VibesProFalconSend';
import type { VibesProChatProps, VibesProMessage as VibesProMessageType } from '../types';

export default function VibesProChat({ messages, currentUserId, onSend }: VibesProChatProps) {
  const [draft, setDraft] = useState('');

  const orderedMessages = useMemo(() => messages ?? [], [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft('');
  };

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        {orderedMessages.map((message) => (
          <VibesProMessage key={message.id} message={message as VibesProMessageType} isOwn={message.role === 'user' && message.id === currentUserId} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <VibesProInput value={draft} onChange={setDraft} onSend={handleSend} placeholder="Write a message" />
        <VibesProFalconSend onSend={handleSend} />
      </div>
    </section>
  );
}
