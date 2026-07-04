import { useMemo, useRef } from 'react';
import type { VibesProInputProps } from '../types';
import scrollImage from '../assets/scroll.png';

export default function VibesProInput({ value = '', onChange, onSend, placeholder = 'Write a royal message...' }: VibesProInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useMemo(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [value]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: '75vw' }}>
        <img src={scrollImage} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', resize: 'none', outline: 'none', padding: '20px 22px 24px', fontFamily: 'Georgia, serif', color: '#4b2e1c', lineHeight: 1.45 }}
        />
      </div>
      <button type="button" onClick={onSend} style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid #d4af37', background: '#f3d07b', color: '#111827', fontWeight: 700 }}>Send</button>
    </div>
  );
}
